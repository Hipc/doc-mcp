# 文档存储与 RAG 服务

基于 TypeScript + PostgreSQL 的文档存储服务，支持 RAG（检索增强生成）功能。

## 功能特性

- 📄 文档上传与存储
- ✂️ 多策略文档切割（可配置块大小和重叠）
- 📝 自动摘要提取
- 🔢 向量嵌入生成（支持内容和摘要双重嵌入）
- 🔗 完整的文档-切片关联

## 项目结构

```
src/
├── config/          # 配置文件
├── controllers/     # 控制器层
├── database/        # 数据库连接
├── middlewares/     # 中间件
├── routes/          # 路由定义
├── services/        # 服务层
│   ├── chunking.service.ts   # 文档切割服务
│   ├── embedding.service.ts  # 向量嵌入服务
│   ├── summary.service.ts    # 摘要提取服务
│   └── document.service.ts   # 文档处理服务
└── index.ts         # 入口文件
```

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

复制 `.env.example` 为 `.env` 并配置：

```bash
cp .env.example .env
```

主要配置项：

- `DATABASE_URL`: PostgreSQL 数据库连接字符串
- `OPENAI_API_KEY`: OpenAI API 密钥
- `CHUNK_STRATEGIES`: 切割策略配置（JSON 格式）

### 3. 初始化数据库

```bash
# 启用 pgvector 扩展（需要先在 PostgreSQL 中安装）
# CREATE EXTENSION vector;

# 运行迁移
npm run prisma:migrate
```

### 4. 启动服务

```bash
# 开发模式
npm run dev

# 调试模式
npm run debug
```

## API 接口

### 上传文档

**POST** `/api/documents`

请求体：

```json
{
  "content": "文档内容（纯文本）",
  "type": "api_doc | tech_doc | code_logic_doc | general_doc",
  "projectName": "项目名称",
  "title": "文档标题（可选）",
  "metadata": {}
}
```

文档类型说明：

- `api_doc`: API 接口文档
- `tech_doc`: 技术实现文档
- `code_logic_doc`: 内部代码逻辑文档
- `general_doc`: 通用文档

响应：

```json
{
  "success": true,
  "data": {
    "documentId": "uuid",
    "title": "文档标题",
    "type": "API_DOC",
    "projectName": "项目名称",
    "chunksCreated": 10,
    "embeddingsCreated": 20,
    "strategies": [
      { "chunkSize": 1000, "overlap": 200 },
      { "chunkSize": 2000, "overlap": 400 }
    ]
  }
}
```

### 获取项目文档列表

**GET** `/api/documents?projectName=xxx`

### 获取文档详情

**GET** `/api/documents/:id`

### 删除文档

**DELETE** `/api/documents/:id`

## 切割策略配置

通过环境变量 `CHUNK_STRATEGIES` 配置多种切割策略：

```json
[
  { "chunkSize": 1000, "overlap": 200, "name": "small" },
  { "chunkSize": 2000, "overlap": 400, "name": "medium" }
]
```

- `chunkSize`: 每个切片的最大字符数
- `overlap`: 相邻切片的重叠字符数
- `name`: 策略名称（可选）

## 调试

使用 VS Code 的调试功能：

1. 打开 VS Code
2. 按 F5 或选择 "Debug with ts-node"
3. 设置断点进行调试

## 数据库模型

- **Document**: 原始文档
- **ChunkStrategy**: 切割策略配置
- **DocumentChunk**: 文档切片（关联文档和策略）
- **ChunkEmbedding**: 向量嵌入（支持内容和摘要两种类型）

## 技术栈

- **TypeScript**: 开发语言
- **Express**: Web 框架
- **Prisma**: ORM
- **PostgreSQL**: 数据库
- **pgvector**: 向量存储扩展
- **OpenAI**: 嵌入和摘要生成
