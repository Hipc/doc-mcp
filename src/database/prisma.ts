import { PrismaClient } from "@prisma/client";

// 创建 Prisma 客户端单例
const prisma = new PrismaClient({
  log: ["query", "info", "warn", "error"],
});

export default prisma;
