import express, { Application } from "express";
import { config } from "./config";
import routes from "./routes";
import { errorHandler, notFoundHandler } from "./middlewares";
import { prisma } from "./database";
import { SUCCESS_MESSAGES, LOG_MESSAGES } from "./constants";

const app: Application = express();

// 中间件
app.use(express.json({ limit: "10mb" })); // 支持大文档上传
app.use(express.urlencoded({ extended: true }));

// API 路由
app.use("/api", routes);

// 错误处理
app.use(notFoundHandler);
app.use(errorHandler);

// 启动服务器
async function start() {
  try {
    // 测试数据库连接
    await prisma.$connect();
    console.log(`✅ ${SUCCESS_MESSAGES.DATABASE_CONNECTED}`);

    // 启动 HTTP 服务器
    app.listen(config.server.port, () => {
      console.log(
        `🚀 ${SUCCESS_MESSAGES.SERVER_STARTED}: http://localhost:${config.server.port}`
      );
      console.log(
        `📚 文档上传接口: POST http://localhost:${config.server.port}/api/documents`
      );
      console.log(`🔧 切割策略: ${JSON.stringify(config.chunkStrategies)}`);
    });
  } catch (error) {
    console.error(`❌ ${LOG_MESSAGES.STARTUP_FAILED}:`, error);
    process.exit(1);
  }
}

// 优雅关闭
process.on("SIGINT", async () => {
  console.log(`\n${LOG_MESSAGES.SHUTTING_DOWN}`);
  await prisma.$disconnect();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.log(`\n${LOG_MESSAGES.SHUTTING_DOWN}`);
  await prisma.$disconnect();
  process.exit(0);
});

start();

export default app;
