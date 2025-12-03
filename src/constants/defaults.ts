/**
 * 默认值常量
 */

// 切割策略配置接口
export interface ChunkStrategyConfig {
  chunkSize: number; // 切割块大小（字符数）
  overlap: number; // 重叠大小（字符数）
  name?: string; // 策略名称
}

// 默认切割策略
export const DEFAULT_CHUNK_STRATEGIES: ChunkStrategyConfig[] = [
  { chunkSize: 1000, overlap: 200, name: "small" },
  { chunkSize: 2000, overlap: 400, name: "medium" },
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
