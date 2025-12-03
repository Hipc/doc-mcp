import dotenv from "dotenv";
import {
  DEFAULT_CHUNK_STRATEGIES,
  DEFAULT_DATABASE_URL,
  DEFAULT_SERVER_PORT,
  DEFAULT_SUMMARY_MAX_TOKENS,
  DEFAULT_CHAT_API_BASE_URL,
  DEFAULT_CHAT_MODEL,
  DEFAULT_EMBEDDING_API_BASE_URL,
  DEFAULT_EMBEDDING_MODEL,
  ChunkStrategyConfig,
} from "../constants";
import { ERROR_MESSAGES } from "../constants";

dotenv.config();

// 重新导出 ChunkStrategyConfig 类型
export type { ChunkStrategyConfig };

// 从环境变量解析切割策略
function parseChunkStrategies(): ChunkStrategyConfig[] {
  const envStrategies = process.env.CHUNK_STRATEGIES;
  if (envStrategies) {
    try {
      return JSON.parse(envStrategies);
    } catch (e) {
      console.warn(ERROR_MESSAGES.CHUNK_STRATEGY_PARSE_ERROR);
    }
  }
  return DEFAULT_CHUNK_STRATEGIES;
}

export const config = {
  // 数据库配置
  database: {
    url: process.env.DATABASE_URL || DEFAULT_DATABASE_URL,
  },

  // Chat API 配置（用于生成摘要等）
  chatApi: {
    apiKey: process.env.CHAT_API_KEY || "",
    baseUrl: process.env.CHAT_API_BASE_URL || DEFAULT_CHAT_API_BASE_URL,
    model: process.env.CHAT_MODEL || DEFAULT_CHAT_MODEL,
  },

  // Embedding API 配置（用于生成向量嵌入）
  embeddingApi: {
    apiKey: process.env.EMBEDDING_API_KEY || "",
    baseUrl:
      process.env.EMBEDDING_API_BASE_URL || DEFAULT_EMBEDDING_API_BASE_URL,
    model: process.env.EMBEDDING_MODEL || DEFAULT_EMBEDDING_MODEL,
  },

  // 服务配置
  server: {
    port: parseInt(process.env.PORT || String(DEFAULT_SERVER_PORT), 10),
  },

  // 切割策略配置
  chunkStrategies: parseChunkStrategies(),

  // 摘要配置
  summary: {
    maxTokens: parseInt(
      process.env.SUMMARY_MAX_TOKENS || String(DEFAULT_SUMMARY_MAX_TOKENS),
      10
    ),
  },
};

export default config;
