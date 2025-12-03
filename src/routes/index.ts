import { Router, IRouter } from "express";
import documentRoutes from "./document.routes";

const router: IRouter = Router();

// 挂载文档路由
router.use("/documents", documentRoutes);

// 健康检查
router.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

export default router;
