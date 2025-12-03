import OpenAI from "openai";
import { config } from "../config";
import { DEFAULT_EMBEDDING_BATCH_SIZE } from "../constants/defaults";
import { ERROR_MESSAGES } from "../constants/messages";

/**
 * 向量嵌入服务
 * 使用 Embedding API 生成文本的向量表示
 */
export class EmbeddingService {
  private openai: OpenAI;
  private model: string;

  constructor() {
    this.openai = new OpenAI({
      apiKey: config.embeddingApi.apiKey,
      baseURL: config.embeddingApi.baseUrl,
    });
    this.model = config.embeddingApi.model;
  }

  /**
   * 为单个文本生成向量嵌入
   * @param text 输入文本
   * @returns 向量数组
   */
  async generateEmbedding(text: string): Promise<number[]> {
    try {
      const response = await this.openai.embeddings.create({
        model: this.model,
        input: text,
      });

      return response.data[0].embedding;
    } catch (error) {
      console.error(ERROR_MESSAGES.EMBEDDING_FAILED, error);
      throw error;
    }
  }

  /**
   * 批量生成向量嵌入
   * @param texts 输入文本数组
   * @returns 向量数组的数组
   */
  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) {
      return [];
    }

    const results: number[][] = [];

    for (let i = 0; i < texts.length; i += DEFAULT_EMBEDDING_BATCH_SIZE) {
      const batch = texts.slice(i, i + DEFAULT_EMBEDDING_BATCH_SIZE);

      try {
        const response = await this.openai.embeddings.create({
          model: this.model,
          input: batch,
        });

        const batchEmbeddings = response.data
          .sort((a, b) => a.index - b.index)
          .map((item) => item.embedding);

        results.push(...batchEmbeddings);
      } catch (error) {
        console.error(
          `${ERROR_MESSAGES.BATCH_EMBEDDING_FAILED} (批次 ${
            i / DEFAULT_EMBEDDING_BATCH_SIZE + 1
          }):`,
          error
        );
        throw error;
      }
    }

    return results;
  }

  /**
   * 获取当前使用的嵌入模型名称
   */
  getModelName(): string {
    return this.model;
  }

  /**
   * 计算两个向量的余弦相似度
   * @param vec1 向量1
   * @param vec2 向量2
   * @returns 相似度分数 (0-1)
   */
  static cosineSimilarity(vec1: number[], vec2: number[]): number {
    if (vec1.length !== vec2.length) {
      throw new Error(ERROR_MESSAGES.VECTOR_DIMENSION_MISMATCH);
    }

    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < vec1.length; i++) {
      dotProduct += vec1[i] * vec2[i];
      norm1 += vec1[i] * vec1[i];
      norm2 += vec2[i] * vec2[i];
    }

    const magnitude = Math.sqrt(norm1) * Math.sqrt(norm2);

    if (magnitude === 0) {
      return 0;
    }

    return dotProduct / magnitude;
  }
}

export default EmbeddingService;
