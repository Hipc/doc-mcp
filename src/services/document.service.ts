import { DocumentType, Prisma } from "@prisma/client";
import { prisma } from "../database";
import {
  ChunkingService,
  StrategyChunkResult,
  ParentChunkResult,
} from "./chunking.service";
import { SummaryService } from "./summary.service";
import { EmbeddingService } from "./embedding.service";
import { config } from "../config";
import { ChunkStrategyConfig, EMBEDDING_TYPES } from "../constants";

/**
 * 文档上传请求参数
 */
export interface UploadDocumentRequest {
  content: string; // 文档内容（纯文本）
  type: DocumentType; // 文档类型
  project_name: string; // 所属项目名称
  title?: string; // 文档标题（可选）
  metadata?: Record<string, any>; // 额外元数据（可选）
}

/**
 * 文档上传响应
 */
export interface UploadDocumentResponse {
  document_id: string;
  title?: string;
  type: DocumentType;
  project_name: string;
  parent_chunks_created: number;
  child_chunks_created: number;
  embeddings_created: number;
  strategies: ChunkStrategyConfig[];
}

/**
 * 文档处理进度回调
 */
export type ProgressCallback = (
  stage: string,
  current: number,
  total: number
) => void;

/**
 * 文档服务
 * 处理文档的上传、切割、摘要生成和向量嵌入
 * 使用父子索引策略：父切片提供上下文，子切片用于向量检索
 */
export class DocumentService {
  private chunkingService: ChunkingService;
  private summaryService: SummaryService;
  private embeddingService: EmbeddingService;

  constructor() {
    this.chunkingService = new ChunkingService();
    this.summaryService = new SummaryService();
    this.embeddingService = new EmbeddingService();
  }

  /**
   * 上传并处理文档（父子索引流程）
   * 1. 保存原始文档
   * 2. 使用递归字符切分创建父子切片
   * 3. 为父切片生成摘要
   * 4. 为子切片生成向量嵌入
   */
  async uploadDocument(
    request: UploadDocumentRequest,
    onProgress?: ProgressCallback
  ): Promise<UploadDocumentResponse> {
    const { content, type, project_name, title, metadata } = request;

    // 阶段1: 保存原始文档
    onProgress?.("saving_document", 0, 1);
    const document = await prisma.document.create({
      data: {
        content,
        type,
        projectName: project_name,
        title,
        metadata: metadata ? (metadata as Prisma.InputJsonValue) : undefined,
      },
    });
    onProgress?.("saving_document", 1, 1);

    // 阶段2: 使用递归字符切分创建父子切片
    onProgress?.("chunking", 0, 1);
    const strategyResults =
      this.chunkingService.chunkWithAllStrategies(content);
    onProgress?.("chunking", 1, 1);

    let totalParentChunksCreated = 0;
    let totalChildChunksCreated = 0;
    let totalEmbeddingsCreated = 0;
    const usedStrategies: ChunkStrategyConfig[] = [];

    // 阶段3: 处理每种策略的切片
    for (
      let strategyIndex = 0;
      strategyIndex < strategyResults.length;
      strategyIndex++
    ) {
      const strategyResult = strategyResults[strategyIndex];
      const { strategy, parentChunks } = strategyResult;

      if (parentChunks.length === 0) continue;

      usedStrategies.push(strategy);

      // 确保策略在数据库中存在
      const dbStrategy = await this.ensureStrategy(strategy);

      // 阶段3.1: 为父切片生成摘要
      onProgress?.("generating_summaries", 0, parentChunks.length);
      const parentSummaries: string[] = [];

      for (let i = 0; i < parentChunks.length; i++) {
        const summary = await this.summaryService.generateSummary(
          parentChunks[i].content,
          type
        );
        parentSummaries.push(summary);
        onProgress?.("generating_summaries", i + 1, parentChunks.length);
      }

      // 阶段3.2: 收集所有子切片内容用于批量生成嵌入
      const allChildContents: string[] = [];
      const childToParentMap: { parentIdx: number; childIdx: number }[] = [];

      for (let pIdx = 0; pIdx < parentChunks.length; pIdx++) {
        const parent = parentChunks[pIdx];
        for (let cIdx = 0; cIdx < parent.children.length; cIdx++) {
          allChildContents.push(parent.children[cIdx].content);
          childToParentMap.push({ parentIdx: pIdx, childIdx: cIdx });
        }
      }

      // 阶段3.3: 为子切片生成向量嵌入
      onProgress?.("generating_embeddings", 0, allChildContents.length);
      const allEmbeddings = await this.embeddingService.generateEmbeddings(
        allChildContents
      );
      onProgress?.(
        "generating_embeddings",
        allChildContents.length,
        allChildContents.length
      );

      // 阶段3.4: 保存父切片、子切片和嵌入到数据库
      onProgress?.("saving_chunks", 0, parentChunks.length);

      let embeddingIndex = 0;

      for (let pIdx = 0; pIdx < parentChunks.length; pIdx++) {
        const parentChunk = parentChunks[pIdx];
        const parentSummary = parentSummaries[pIdx];

        // 创建父切片记录
        const dbParentChunk = await prisma.parentChunk.create({
          data: {
            content: parentChunk.content,
            parentIndex: parentChunk.parentIndex,
            startPosition: parentChunk.startPosition,
            endPosition: parentChunk.endPosition,
            summary: parentSummary,
            documentId: document.id,
            strategyId: dbStrategy.id,
          },
        });
        totalParentChunksCreated++;

        // 创建子切片记录
        for (let cIdx = 0; cIdx < parentChunk.children.length; cIdx++) {
          const childChunk = parentChunk.children[cIdx];
          const childEmbedding = allEmbeddings[embeddingIndex];

          // 创建子切片
          const dbChildChunk = await prisma.childChunk.create({
            data: {
              content: childChunk.content,
              chunkIndex: childChunk.chunkIndex,
              startPosition: childChunk.startPosition,
              endPosition: childChunk.endPosition,
              parentChunkId: dbParentChunk.id,
            },
          });
          totalChildChunksCreated++;

          // 保存子切片的向量嵌入
          if (childEmbedding && childEmbedding.length > 0) {
            await this.saveEmbedding(
              dbChildChunk.id,
              childEmbedding,
              EMBEDDING_TYPES.CONTENT
            );
            totalEmbeddingsCreated++;
          }

          embeddingIndex++;
        }

        onProgress?.("saving_chunks", pIdx + 1, parentChunks.length);
      }
    }

    return {
      document_id: document.id,
      title: document.title || undefined,
      type: document.type,
      project_name: document.projectName,
      parent_chunks_created: totalParentChunksCreated,
      child_chunks_created: totalChildChunksCreated,
      embeddings_created: totalEmbeddingsCreated,
      strategies: usedStrategies,
    };
  }

  /**
   * 确保切割策略存在于数据库中（父子索引版本）
   */
  private async ensureStrategy(
    strategy: ChunkStrategyConfig
  ): Promise<{ id: string }> {
    const existing = await prisma.chunkStrategy.findUnique({
      where: {
        parentChunkSize_childChunkSize_overlapPercent: {
          parentChunkSize: strategy.parentChunkSize,
          childChunkSize: strategy.childChunkSize,
          overlapPercent: strategy.overlapPercent,
        },
      },
    });

    if (existing) {
      return existing;
    }

    return await prisma.chunkStrategy.create({
      data: {
        parentChunkSize: strategy.parentChunkSize,
        childChunkSize: strategy.childChunkSize,
        overlapPercent: strategy.overlapPercent,
        name: strategy.name,
      },
    });
  }

  /**
   * 保存向量嵌入到数据库
   * 使用原始 SQL 因为 Prisma 不直接支持 vector 类型
   */
  private async saveEmbedding(
    chunkId: string,
    embedding: number[],
    embeddingType: "content" | "summary"
  ): Promise<void> {
    const embeddingStr = `[${embedding.join(",")}]`;
    const model = this.embeddingService.getModelName();
    const id = crypto.randomUUID();

    await prisma.$executeRaw`
      INSERT INTO chunk_embeddings (id, embedding, "embeddingType", model, "chunkId", "createdAt")
      VALUES (${id}, ${embeddingStr}::vector, ${embeddingType}, ${model}, ${chunkId}, NOW())
    `;
  }

  /**
   * 根据ID获取文档（包含父子切片）
   */
  async getDocument(documentId: string) {
    return await prisma.document.findUnique({
      where: { id: documentId },
      include: {
        parentChunks: {
          include: {
            strategy: true,
            childChunks: {
              include: {
                embeddings: true,
              },
            },
          },
        },
      },
    });
  }

  /**
   * 根据项目名称获取文档列表
   */
  async getDocumentsByProject(projectName: string) {
    return await prisma.document.findMany({
      where: { projectName },
      orderBy: { createdAt: "desc" },
    });
  }

  /**
   * 删除文档（级联删除所有关联的切片和嵌入）
   */
  async deleteDocument(documentId: string): Promise<boolean> {
    const result = await prisma.document.delete({
      where: { id: documentId },
    });
    return !!result;
  }
}

export default DocumentService;
