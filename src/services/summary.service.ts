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

interface ChatCompletionResponse {
  choices: Array<{
    message: {
      content: string;
    };
    index: number;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * 摘要提取服务
 * 使用 Chat API 对文档切片生成摘要
 */
export class SummaryService {
  private apiKey: string;
  private baseUrl: string;
  private model: string;
  private maxTokens: number;

  constructor() {
    this.apiKey = config.chatApi.apiKey;
    this.baseUrl = config.chatApi.baseUrl;
    this.model = config.chatApi.model;
    this.maxTokens = config.summary.maxTokens;
  }

  /**
   * 调用 Chat API
   */
  private async callChatApi(
    systemPrompt: string,
    userContent: string,
    maxTokens?: number
  ): Promise<string> {
    const url = `${this.baseUrl}/chat/completions`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ],
        max_tokens: maxTokens || this.maxTokens,
        temperature: DEFAULT_SUMMARY_TEMPERATURE,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Chat API error: ${response.status} - ${errorText}`);
    }

    const data = (await response.json()) as ChatCompletionResponse;
    return data.choices[0]?.message?.content || "";
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
    // 如果内容为空，直接返回空字符串
    if (!content || content.trim().length === 0) {
      return "";
    }

    const systemPrompt = this.getSystemPrompt(documentType);

    try {
      const summary = await this.callChatApi(
        systemPrompt,
        `${SUMMARY_REQUEST_TEMPLATE}${content}`
      );

      // 如果摘要为空，使用内容的前200字作为摘要
      if (!summary.trim()) {
        return content.slice(0, 200) + (content.length > 200 ? "..." : "");
      }
      return summary;
    } catch (error) {
      console.error(ERROR_MESSAGES.SUMMARY_FAILED, error);
      throw error;
    }
  }

  /**
   * 为整个文档生成摘要
   * @param content 完整文档内容
   * @param documentType 文档类型
   * @param title 文档标题（可选）
   * @returns 生成的文档摘要
   */
  async generateDocumentSummary(
    content: string,
    documentType: string,
    title?: string
  ): Promise<string> {
    if (!content || content.trim().length === 0) {
      return "";
    }

    const systemPrompt = this.getDocumentSummaryPrompt(documentType);
    const userContent = title
      ? `文档标题：${title}\n\n文档内容：\n${content}`
      : `文档内容：\n${content}`;

    try {
      // 文档摘要使用更多的 token
      const summary = await this.callChatApi(
        systemPrompt,
        userContent,
        this.maxTokens * 2
      );

      if (!summary.trim()) {
        return content.slice(0, 500) + (content.length > 500 ? "..." : "");
      }
      return summary;
    } catch (error) {
      console.error("生成文档摘要失败:", error);
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
   * 根据文档类型获取优化的系统提示词（用于切片摘要）
   */
  private getSystemPrompt(documentType?: string): string {
    return (
      DOCUMENT_TYPE_PROMPTS[documentType || "GENERAL_DOC"] ||
      BASE_SUMMARY_PROMPT
    );
  }

  /**
   * 根据文档类型获取文档级别摘要的系统提示词
   */
  private getDocumentSummaryPrompt(documentType: string): string {
    const typeDescriptions: Record<string, string> = {
      API_DOC: "API接口文档",
      TECH_DOC: "技术实现文档",
      CODE_LOGIC_DOC: "代码逻辑文档",
      GENERAL_DOC: "通用文档",
    };

    const typeDesc = typeDescriptions[documentType] || "文档";

    return `你是一个专业的${typeDesc}摘要生成专家。请为提供的完整文档生成一个全面的摘要。

摘要要求：
1. 概述文档的主要目的和核心内容
2. 提取关键信息点和重要概念
3. 保持结构清晰，使用要点列表形式
4. 摘要长度控制在300-500字之间
5. 使用与原文档相同的语言

${this.getTypeSpecificGuidelines(documentType)}

请直接输出摘要内容，不要添加额外的说明。`;
  }

  /**
   * 获取特定文档类型的额外指导
   */
  private getTypeSpecificGuidelines(documentType: string): string {
    switch (documentType) {
      case "API_DOC":
        return `针对API文档，请特别关注：
- API的对外调用方式
- API的主要功能和用途
- 关键接口端点列表
- 认证方式
- 主要的请求/响应格式`;
      case "TECH_DOC":
        return `针对技术文档，请特别关注：
- 技术架构概述
- 核心技术栈和依赖
- 关键设计决策
- 部署和配置要点`;
      case "CODE_LOGIC_DOC":
        return `针对代码逻辑文档，请特别关注：
- 代码的主要功能
- 核心算法或逻辑流程
- 关键函数/类的作用
- 输入输出说明`;
      default:
        return "";
    }
  }
}

export default SummaryService;
