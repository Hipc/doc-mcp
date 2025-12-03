/**
 * 默认值常量
 */

// 切割策略配置接口（父子索引）
export interface ChunkStrategyConfig {
  parentChunkSize: number; // 父块大小（字符数）
  childChunkSize: number; // 子块大小（字符数）
  overlapPercent: number; // 重叠百分比（0-100，默认20）
  name?: string; // 策略名称
}

// 递归字符切分的分隔符列表（按优先级排序）
export const RECURSIVE_SEPARATORS = [
  "\n\n", // 段落分隔
  "\n", // 换行
  "。", // 中文句号
  "！", // 中文感叹号
  "？", // 中文问号
  ".", // 英文句号
  "!", // 英文感叹号
  "?", // 英文问号
  ";", // 英文分号
  "；", // 中文分号
  ",", // 英文逗号
  "，", // 中文逗号
  " ", // 空格
  "", // 字符级切分（最后手段）
];

// 默认切割策略（父子索引）
// 优化后的参数：
// - 增大子切片大小以包含更多上下文
// - 增加重叠比例以保持语义连贯性
export const DEFAULT_CHUNK_STRATEGIES: ChunkStrategyConfig[] = [
  {
    parentChunkSize: 2000,
    childChunkSize: 800,
    overlapPercent: 25,
    name: "default",
  },
];

// 默认服务配置
export const DEFAULT_SERVER_PORT = 3000;

// 默认摘要配置
export const DEFAULT_SUMMARY_MAX_TOKENS = 200;
export const DEFAULT_SUMMARY_TEMPERATURE = 0.3;

// 默认并发配置
export const DEFAULT_SUMMARY_CONCURRENCY = 5;
export const DEFAULT_EMBEDDING_BATCH_SIZE = 100;

// 默认数据库 URL
export const DEFAULT_DATABASE_URL = "postgresql://localhost:5432/doc_mcp";

// 默认 Chat API 配置
export const DEFAULT_CHAT_API_BASE_URL = "https://api.openai.com/v1";
export const DEFAULT_CHAT_MODEL = "gpt-4o-mini";

// 默认 Embedding API 配置
export const DEFAULT_EMBEDDING_API_BASE_URL = "https://api.openai.com/v1";
export const DEFAULT_EMBEDDING_MODEL = "text-embedding-3-small";

// 嵌入类型
export const EMBEDDING_TYPES = {
  CONTENT: "content",
  SUMMARY: "summary",
} as const;

// 文档类型映射
export const DOCUMENT_TYPE_MAP: Record<string, string> = {
  api: "API_DOC",
  api_doc: "API_DOC",
  tech: "TECH_DOC",
  tech_doc: "TECH_DOC",
  code: "CODE_LOGIC_DOC",
  code_logic: "CODE_LOGIC_DOC",
  code_logic_doc: "CODE_LOGIC_DOC",
  general: "GENERAL_DOC",
  general_doc: "GENERAL_DOC",
};
