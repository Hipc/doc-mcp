import { config } from "../config";
import { DEFAULT_EMBEDDING_BATCH_SIZE } from "../constants/defaults";
import { ERROR_MESSAGES } from "../constants/messages";

interface EmbeddingResponse {
  data: Array<{
    embedding: number[];
    index: number;
  }>;
  model: string;
  usage: {
    prompt_tokens: number;
    total_tokens: number;
  };
}

/**
 * 向量嵌入服务
 * 使用 Embedding API 生成文本的向量表示
 */
export class EmbeddingService {
  private apiKey: string;
  private baseUrl: string;
  private model: string;

  constructor() {
    this.apiKey = config.embeddingApi.apiKey;
    this.baseUrl = config.embeddingApi.baseUrl;
    this.model = config.embeddingApi.model;
  }

  /**
   * 调用 Embedding API
   * @param input 输入文本或文本数组
   * @returns API 响应
   */
  private async callEmbeddingApi(
    input: string | string[]
  ): Promise<EmbeddingResponse> {
    const url = `${this.baseUrl}/embeddings`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        input: input,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Embedding API error: ${response.status} - ${errorText}`);
    }

    return response.json() as Promise<EmbeddingResponse>;
  }

  /**
   * 为单个文本生成向量嵌入
   * @param text 输入文本
   * @returns 向量数组
   */
  async generateEmbedding(text: string): Promise<number[]> {
    try {
      console.log("Generating embedding for text with length:", text.length);
      const response = await this.callEmbeddingApi(text);

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

    // 过滤空文本并记录原始索引
    const validTexts: { index: number; text: string }[] = [];
    for (let i = 0; i < texts.length; i++) {
      const text = texts[i]?.trim();
      if (text && text.length > 0) {
        validTexts.push({ index: i, text });
      }
    }

    if (validTexts.length === 0) {
      // 如果所有文本都为空，返回空向量数组
      console.warn("所有输入文本都为空，无法生成嵌入");
      return texts.map(() => []);
    }

    const results: number[][] = new Array(texts.length).fill([]);

    for (let i = 0; i < validTexts.length; i += DEFAULT_EMBEDDING_BATCH_SIZE) {
      const batch = validTexts.slice(i, i + DEFAULT_EMBEDDING_BATCH_SIZE);
      const batchTexts = batch.map((item) => item.text);

      try {
        const response = await this.callEmbeddingApi(batchTexts);

        const batchEmbeddings = response.data
          .sort((a, b) => a.index - b.index)
          .map((item) => item.embedding);

        // 将结果放回原始位置
        for (let j = 0; j < batch.length; j++) {
          results[batch[j].index] = batchEmbeddings[j];
        }
      } catch (error) {
        console.error(
          `${ERROR_MESSAGES.BATCH_EMBEDDING_FAILED} (批次 ${
            Math.floor(i / DEFAULT_EMBEDDING_BATCH_SIZE) + 1
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
