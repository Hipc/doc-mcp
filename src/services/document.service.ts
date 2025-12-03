import { DocumentType, Prisma } from "@prisma/client";
import { prisma } from "../database";
import { ChunkingService, StrategyChunkResult } from "./chunking.service";
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
  projectName: string; // 所属项目名称
  title?: string; // 文档标题（可选）
  metadata?: Record<string, any>; // 额外元数据（可选）
}

/**
 * 文档上传响应
 */
export interface UploadDocumentResponse {
  documentId: string;
  title?: string;
  type: DocumentType;
  projectName: string;
  chunksCreated: number;
  embeddingsCreated: number;
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
   * 上传并处理文档
   * 完整的 RAG 处理流程：
   * 1. 保存原始文档
   * 2. 使用多种策略切割文档
   * 3. 为每个切片生成摘要
   * 4. 为切片内容和摘要生成向量嵌入
   */
  async uploadDocument(
    request: UploadDocumentRequest,
    onProgress?: ProgressCallback
  ): Promise<UploadDocumentResponse> {
    const { content, type, projectName, title, metadata } = request;

    // 阶段1: 保存原始文档
    onProgress?.("saving_document", 0, 1);
    const document = await prisma.document.create({
      data: {
        content,
        type,
        projectName,
        title,
        metadata: metadata ? (metadata as Prisma.InputJsonValue) : undefined,
      },
    });
    onProgress?.("saving_document", 1, 1);

    // 阶段2: 使用多种策略切割文档
    onProgress?.("chunking", 0, 1);
    const strategyResults =
      this.chunkingService.chunkWithAllStrategies(content);
    onProgress?.("chunking", 1, 1);

    let totalChunksCreated = 0;
    let totalEmbeddingsCreated = 0;
    const usedStrategies: ChunkStrategyConfig[] = [];

    // 阶段3: 处理每种策略的切片
    for (
      let strategyIndex = 0;
      strategyIndex < strategyResults.length;
      strategyIndex++
    ) {
      const strategyResult = strategyResults[strategyIndex];
      const { strategy, chunks } = strategyResult;

      if (chunks.length === 0) continue;

      usedStrategies.push(strategy);

      // 确保策略在数据库中存在
      const dbStrategy = await this.ensureStrategy(strategy);

      // 阶段3.1: 为每个切片生成摘要
      onProgress?.("generating_summaries", 0, chunks.length);
      const summaries: string[] = [];

      for (let i = 0; i < chunks.length; i++) {
        const summary = await this.summaryService.generateSummary(
          chunks[i].content,
          type
        );
        summaries.push(summary);
        onProgress?.("generating_summaries", i + 1, chunks.length);
      }

      // 阶段3.2: 生成向量嵌入（同时为内容和摘要生成）
      onProgress?.("generating_embeddings", 0, chunks.length * 2);

      // 准备所有需要嵌入的文本
      const contentTexts = chunks.map((c) => c.content);
      const summaryTexts = summaries;
      const allTexts = [...contentTexts, ...summaryTexts];

      const allEmbeddings = await this.embeddingService.generateEmbeddings(
        allTexts
      );
      const contentEmbeddings = allEmbeddings.slice(0, chunks.length);
      const summaryEmbeddings = allEmbeddings.slice(chunks.length);

      onProgress?.(
        "generating_embeddings",
        chunks.length * 2,
        chunks.length * 2
      );

      // 阶段3.3: 保存切片和嵌入到数据库
      onProgress?.("saving_chunks", 0, chunks.length);

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const summary = summaries[i];
        const contentEmbedding = contentEmbeddings[i];
        const summaryEmbedding = summaryEmbeddings[i];

        // 创建切片记录
        const dbChunk = await prisma.documentChunk.create({
          data: {
            content: chunk.content,
            chunkIndex: chunk.chunkIndex,
            startPosition: chunk.startPosition,
            endPosition: chunk.endPosition,
            summary,
            documentId: document.id,
            strategyId: dbStrategy.id,
          },
        });

        // 保存内容向量嵌入
        await this.saveEmbedding(
          dbChunk.id,
          contentEmbedding,
          EMBEDDING_TYPES.CONTENT
        );

        // 保存摘要向量嵌入
        await this.saveEmbedding(
          dbChunk.id,
          summaryEmbedding,
          EMBEDDING_TYPES.SUMMARY
        );

        totalChunksCreated++;
        totalEmbeddingsCreated += 2; // 每个切片有两个嵌入（内容+摘要）

        onProgress?.("saving_chunks", i + 1, chunks.length);
      }
    }

    return {
      documentId: document.id,
      title: document.title || undefined,
      type: document.type,
      projectName: document.projectName,
      chunksCreated: totalChunksCreated,
      embeddingsCreated: totalEmbeddingsCreated,
      strategies: usedStrategies,
    };
  }

  /**
   * 确保切割策略存在于数据库中
   */
  private async ensureStrategy(
    strategy: ChunkStrategyConfig
  ): Promise<{ id: string }> {
    const existing = await prisma.chunkStrategy.findUnique({
      where: {
        chunkSize_overlap: {
          chunkSize: strategy.chunkSize,
          overlap: strategy.overlap,
        },
      },
    });

    if (existing) {
      return existing;
    }

    return await prisma.chunkStrategy.create({
      data: {
        chunkSize: strategy.chunkSize,
        overlap: strategy.overlap,
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
   * 根据ID获取文档
   */
  async getDocument(documentId: string) {
    return await prisma.document.findUnique({
      where: { id: documentId },
      include: {
        chunks: {
          include: {
            strategy: true,
            embeddings: true,
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
