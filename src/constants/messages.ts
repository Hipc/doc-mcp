/**
 * 消息和错误提示常量
 */

// 错误消息
export const ERROR_MESSAGES = {
  // 参数验证错误
  MISSING_CONTENT: "缺少必需参数: content（文档内容）",
  MISSING_TYPE: "缺少必需参数: type（文档类型）",
  MISSING_PROJECT_NAME: "缺少必需参数: projectName（项目名称）",
  MISSING_DOCUMENT_ID: "缺少文档ID",
  MISSING_QUERY_PROJECT_NAME: "缺少查询参数: projectName",

  // 资源错误
  DOCUMENT_NOT_FOUND: "文档不存在",
  API_NOT_FOUND: "接口不存在",

  // 服务错误
  DATABASE_ERROR: "数据库操作失败",
  AI_SERVICE_ERROR: "AI 服务调用失败",
  INTERNAL_ERROR: "服务器内部错误",

  // AI 相关错误
  EMBEDDING_FAILED: "生成向量嵌入失败",
  SUMMARY_FAILED: "生成摘要失败",
  BATCH_EMBEDDING_FAILED: "批量生成向量嵌入失败",

  // 配置错误
  CHUNK_STRATEGY_PARSE_ERROR:
    "无法解析 CHUNK_STRATEGIES 环境变量，使用默认策略",
  VECTOR_DIMENSION_MISMATCH: "向量维度不匹配",
} as const;

// 成功消息
export const SUCCESS_MESSAGES = {
  DOCUMENT_DELETED: "文档已删除",
  DATABASE_CONNECTED: "数据库连接成功",
  SERVER_STARTED: "服务器启动成功",
} as const;

// 日志消息
export const LOG_MESSAGES = {
  PROCESSING_DOCUMENT: "开始处理文档上传",
  DOCUMENT_UPLOAD_COMPLETE: "文档上传完成",
  DOCUMENT_UPLOAD_FAILED: "文档上传失败",
  GET_DOCUMENT_FAILED: "获取文档失败",
  GET_DOCUMENT_LIST_FAILED: "获取文档列表失败",
  DELETE_DOCUMENT_FAILED: "删除文档失败",
  SHUTTING_DOWN: "正在关闭服务...",
  STARTUP_FAILED: "启动失败",
} as const;
