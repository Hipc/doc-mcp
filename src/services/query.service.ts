import { config } from "../config";
import { DEFAULT_SUMMARY_TEMPERATURE } from "../constants/defaults";

interface ChatCompletionResponse {
  choices: Array<{
    message: {
      content: string;
    };
    index: number;
  }>;
}

/**
 * 查询改写服务
 * 使用 LLM 对用户查询进行扩展和优化，提高检索效果
 */
export class QueryService {
  private apiKey: string;
  private baseUrl: string;
  private model: string;

  constructor() {
    this.apiKey = config.chatApi.apiKey;
    this.baseUrl = config.chatApi.baseUrl;
    this.model = config.chatApi.model;
  }

  /**
   * 调用 Chat API
   */
  private async callChatApi(
    systemPrompt: string,
    userContent: string
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
        max_tokens: 20000,
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
   * 扩展查询
   * 将用户的简短查询扩展为更详细的搜索查询，包含同义词和相关概念
   * @param query 原始查询
   * @returns 扩展后的查询
   */
  async expandQuery(query: string): Promise<string> {
    const systemPrompt = `你是一个查询扩展专家。你的任务是将用户的简短查询扩展为更详细的搜索查询。

规则：
1. 保留原始查询的核心意图
2. 添加相关的同义词和近义词
3. 添加可能相关的技术术语
4. 输出格式为一段连续的文本，不要用列表
5. 长度控制在100-150字
6. 直接输出扩展后的查询，不要有任何前缀或解释`;

    try {
      const expanded = await this.callChatApi(
        systemPrompt,
        `请扩展以下查询：${query}`
      );
      return expanded.trim() || query;
    } catch (error) {
      console.error("查询扩展失败，使用原始查询:", error);
      return query;
    }
  }

  /**
   * 生成假设性文档 (HyDE)
   * 根据查询生成一个假设性的答案文档片段
   * 这个假设文档的 embedding 通常比直接用问题更有效
   * @param query 原始查询
   * @returns 假设性文档内容
   */
  async generateHypotheticalDocument(query: string): Promise<string> {
    const systemPrompt = `你是一个技术文档专家。根据用户的问题，生成一段假设性的文档内容，就像这段内容存在于某个文档中能够回答这个问题。

规则：
1. 直接生成文档内容，不要有"根据您的问题"等前缀
2. 使用技术文档的写作风格
3. 内容应该具体且信息丰富
4. 长度控制在150-250字
5. 可以包含代码示例、API说明、配置示例等（如果相关）`;

    try {
      const hypotheticalDoc = await this.callChatApi(
        systemPrompt,
        `为以下问题生成假设性文档片段：${query}`
      );
      return hypotheticalDoc.trim() || query;
    } catch (error) {
      console.error("生成假设性文档失败，使用原始查询:", error);
      return query;
    }
  }

  /**
   * 多查询改写
   * 将原始查询改写为多个不同角度的查询
   * @param query 原始查询
   * @returns 改写后的查询数组
   */
  async generateMultipleQueries(query: string): Promise<string[]> {
    const systemPrompt = `你是一个查询改写专家。将用户的查询改写为3个不同角度的查询，以提高检索召回率。

规则：
1. 每个改写查询应从不同角度表达相同的信息需求
2. 使用不同的词汇和表达方式
3. 每个查询用换行符分隔
4. 只输出3个查询，不要编号，不要解释`;

    try {
      const result = await this.callChatApi(
        systemPrompt,
        `请改写以下查询：${query}`
      );
      const queries = result
        .split("\n")
        .map((q) => q.trim())
        .filter((q) => q.length > 0);
      return queries.length > 0 ? queries : [query];
    } catch (error) {
      console.error("多查询改写失败，使用原始查询:", error);
      return [query];
    }
  }

  /**
   * 获取增强后的查询文本
   * 结合原始查询和扩展查询
   * @param query 原始查询
   * @param useHyDE 是否使用 HyDE 方法
   * @returns 增强后的查询文本
   */
  async getEnhancedQuery(
    query: string,
    useHyDE: boolean = false
  ): Promise<string> {
    if (useHyDE) {
      console.log("使用 HyDE 方法生成假设性文档");
      return this.generateHypotheticalDocument(query);
    }
    console.log("使用查询扩展方法");
    return this.expandQuery(query);
  }
}

export default QueryService;
