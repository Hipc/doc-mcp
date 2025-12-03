import OpenAI from "openai";
import { config } from "../config";
import {
  DOCUMENT_TYPE_PROMPTS,
  BASE_SUMMARY_PROMPT,
  SUMMARY_REQUEST_TEMPLATE,
} from "../constants/prompts";
import {
  DEFAULT_SUMMARY_TEMPERATURE,
  DEFAULT_SUMMARY_CONCURRENCY,
} from "../constants/defaults";
import { ERROR_MESSAGES } from "../constants/messages";

/**
 * 摘要提取服务
 * 使用 Chat API 对文档切片生成摘要
 */
export class SummaryService {
  private openai: OpenAI;
  private model: string;
  private maxTokens: number;

  constructor() {
    this.openai = new OpenAI({
      apiKey: config.chatApi.apiKey,
      baseURL: config.chatApi.baseUrl,
    });
    this.model = config.chatApi.model;
    this.maxTokens = config.summary.maxTokens;
  }

  /**
   * 为文档切片生成摘要
   * @param content 切片内容
   * @param documentType 文档类型（用于优化提示词）
   * @returns 生成的摘要
   */
  async generateSummary(
    content: string,
    documentType?: string
  ): Promise<string> {
    const systemPrompt = this.getSystemPrompt(documentType);

    try {
      const response = await this.openai.chat.completions.create({
        model: this.model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `${SUMMARY_REQUEST_TEMPLATE}${content}` },
        ],
        max_tokens: this.maxTokens,
        temperature: DEFAULT_SUMMARY_TEMPERATURE,
      });

      return response.choices[0]?.message?.content || "";
    } catch (error) {
      console.error(ERROR_MESSAGES.SUMMARY_FAILED, error);
      throw error;
    }
  }

  /**
   * 批量生成摘要
   * @param contents 切片内容数组
   * @param documentType 文档类型
   * @returns 摘要数组
   */
  async generateSummaries(
    contents: string[],
    documentType?: string
  ): Promise<string[]> {
    const results: string[] = [];

    for (let i = 0; i < contents.length; i += DEFAULT_SUMMARY_CONCURRENCY) {
      const batch = contents.slice(i, i + DEFAULT_SUMMARY_CONCURRENCY);
      const batchResults = await Promise.all(
        batch.map((content) => this.generateSummary(content, documentType))
      );
      results.push(...batchResults);
    }

    return results;
  }

  /**
   * 根据文档类型获取优化的系统提示词
   */
  private getSystemPrompt(documentType?: string): string {
    return (
      DOCUMENT_TYPE_PROMPTS[documentType || "GENERAL_DOC"] ||
      BASE_SUMMARY_PROMPT
    );
  }
}

export default SummaryService;
