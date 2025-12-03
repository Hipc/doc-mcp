import { Request, Response, NextFunction } from "express";
import { ERROR_MESSAGES } from "../constants";

/**
 * 全局错误处理中间件
 */
export function errorHandler(
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
) {
  console.error("Error:", error);

  // Prisma 错误处理
  if (error.name === "PrismaClientKnownRequestError") {
    return res.status(400).json({
      success: false,
      error: ERROR_MESSAGES.DATABASE_ERROR,
      details: error.message,
    });
  }

  // OpenAI API 错误
  if (error.name === "APIError" || error.message?.includes("OpenAI")) {
    return res.status(502).json({
      success: false,
      error: ERROR_MESSAGES.AI_SERVICE_ERROR,
      details: error.message,
    });
  }

  // 默认错误响应
  return res.status(500).json({
    success: false,
    error: ERROR_MESSAGES.INTERNAL_ERROR,
    details: process.env.NODE_ENV === "development" ? error.message : undefined,
  });
}

/**
 * 404 处理中间件
 */
export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({
    success: false,
    error: ERROR_MESSAGES.API_NOT_FOUND,
    path: req.path,
  });
}
