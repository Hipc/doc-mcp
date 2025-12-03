import { Router, IRouter } from "express";
import {
  uploadDocument,
  getDocument,
  getDocumentsByProject,
  deleteDocument,
} from "../controllers";

const router: IRouter = Router();

/**
 * 文档相关路由
 */

// 上传文档
router.post("/", uploadDocument);

// 获取项目的文档列表
router.get("/", getDocumentsByProject);

// 获取文档详情
router.get("/:id", getDocument);

// 删除文档
router.delete("/:id", deleteDocument);

export default router;
