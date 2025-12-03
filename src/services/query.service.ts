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
 * 查询策略类型
 */
export type QueryStrategy = "direct" | "expansion" | "hyde";

/**
 * AI 分析查询结果
 */
export interface QueryAnalysis {
  strategy: QueryStrategy;
  reason: string;
  confidence: number;
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
    userContent: string,
    maxTokens: number = 20000
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
        max_tokens: maxTokens,
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
   * AI 智能分析查询，决定最佳检索策略
   * @param query 用户查询
   * @returns 查询分析结果，包含推荐策略
   */
  async analyzeQuery(query: string): Promise<QueryAnalysis> {
    const systemPrompt = `你是一个智能查询分析专家。分析用户的查询，决定最佳的检索策略。

三种策略：
1. **direct** - 直接检索：查询已经足够清晰具体，包含明确的关键词或术语
   - 适用：精确搜索、包含代码/API名称、专业术语明确
   - 例如："getUserById函数"、"DATABASE_URL配置"、"prisma schema定义"

2. **expansion** - 查询扩展：查询较短或词汇单一，需要扩展同义词和相关术语
   - 适用：短查询、单个词、可能有多种表述方式
   - 例如："数据库"、"认证"、"缓存配置"

3. **hyde** - 假设文档：查询是问句或描述性需求，与文档表述方式差异大
   - 适用：如何/怎么问题、故障排查、概念解释、最佳实践
   - 例如："如何配置数据库连接？"、"为什么请求超时？"、"什么是向量嵌入？"

请以JSON格式输出分析结果：
{
  "strategy": "direct|expansion|hyde",
  "reason": "简短说明选择理由",
  "confidence": 0.0-1.0
}

只输出JSON，不要其他内容。`;

    try {
      const result = await this.callChatApi(
        systemPrompt,
        `分析以下查询：${query}`,
        2000
      );

      // 解析 JSON 结果
      const jsonMatch = result.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const analysis = JSON.parse(jsonMatch[0]) as QueryAnalysis;
        // 验证策略值
        if (!["direct", "expansion", "hyde"].includes(analysis.strategy)) {
          analysis.strategy = "expansion";
        }
        console.log(
          `[查询分析] 策略: ${analysis.strategy}, 原因: ${analysis.reason}, 置信度: ${analysis.confidence}`
        );
        return analysis;
      }

      // 解析失败，使用默认策略
      return this.getDefaultStrategy(query);
    } catch (error) {
      console.error("查询分析失败，使用默认策略:", error);
      return this.getDefaultStrategy(query);
    }
  }

  /**
   * 基于规则的默认策略（AI 分析失败时的回退）
   */
  private getDefaultStrategy(query: string): QueryAnalysis {
    const trimmedQuery = query.trim();

    // 问句模式 -> HyDE
    if (
      /^(如何|怎么|怎样|为什么|什么是|是什么|how|what|why|when|where)/i.test(
        trimmedQuery
      )
    ) {
      return { strategy: "hyde", reason: "问句类型查询", confidence: 0.7 };
    }

    // 短查询 -> 扩展
    if (trimmedQuery.length < 10 || trimmedQuery.split(/\s+/).length < 3) {
      return {
        strategy: "expansion",
        reason: "短查询需要扩展",
        confidence: 0.6,
      };
    }

    // 包含代码特征 -> 直接检索
    if (/[A-Z][a-z]+[A-Z]|_[a-z]+|\.[\w]+\(|`/.test(trimmedQuery)) {
      return {
        strategy: "direct",
        reason: "包含代码/API特征",
        confidence: 0.8,
      };
    }

    // 默认使用扩展
    return { strategy: "expansion", reason: "默认策略", confidence: 0.5 };
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
   * 获取增强后的查询文本（手动指定策略）
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

  /**
   * 智能获取增强后的查询文本（AI 自动选择策略）
   * @param query 原始查询
   * @returns 增强后的查询文本和使用的策略
   */
  async getSmartEnhancedQuery(query: string): Promise<{
    enhancedQuery: string;
    strategy: QueryStrategy;
    analysis: QueryAnalysis;
  }> {
    // AI 分析最佳策略
    const analysis = await this.analyzeQuery(query);

    let enhancedQuery: string;

    switch (analysis.strategy) {
      case "direct":
        // 直接使用原始查询
        console.log("[智能查询] 使用直接检索策略");
        enhancedQuery = query;
        break;

      case "hyde":
        // 使用 HyDE 生成假设文档
        console.log("[智能查询] 使用 HyDE 策略");
        enhancedQuery = await this.generateHypotheticalDocument(query);
        break;

      case "expansion":
      default:
        // 使用查询扩展
        console.log("[智能查询] 使用查询扩展策略");
        enhancedQuery = await this.expandQuery(query);
        break;
    }

    return {
      enhancedQuery,
      strategy: analysis.strategy,
      analysis,
    };
  }
}

export default QueryService;
