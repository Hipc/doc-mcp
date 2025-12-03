import { Request, Response, NextFunction } from "express";
import { DocumentType } from "@prisma/client";
import {
  DocumentService,
  UploadDocumentRequest,
  SearchDocumentRequest,
} from "../services";
import {
  ERROR_MESSAGES,
  SUCCESS_MESSAGES,
  LOG_MESSAGES,
  DOCUMENT_TYPE_MAP,
} from "../constants";

const documentService = new DocumentService();

/**
 * 解析文档类型
 */
function parseDocumentType(typeStr: string): DocumentType {
  const normalizedType = typeStr.toLowerCase().replace(/-/g, "_");
  const mappedType = DOCUMENT_TYPE_MAP[normalizedType];
  return (mappedType as DocumentType) || DocumentType.GENERAL_DOC;
}

/**
 * 上传文档接口
 * POST /api/documents
 *
 * 请求体:
 * {
 *   "content": "文档内容（纯文本）",
 *   "type": "api_doc | tech_doc | code_logic_doc | general_doc",
 *   "project_name": "项目名称",
 *   "title": "文档标题（可选）",
 *   "metadata": { ... }（可选）
 * }
 */
export async function uploadDocument(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { content, type, project_name, title, metadata } = req.body;

    // 参数验证
    if (!content || typeof content !== "string") {
      return res.status(400).json({
        success: false,
        error: ERROR_MESSAGES.MISSING_CONTENT,
      });
    }

    if (!type || typeof type !== "string") {
      return res.status(400).json({
        success: false,
        error: ERROR_MESSAGES.MISSING_TYPE,
      });
    }

    if (!project_name || typeof project_name !== "string") {
      return res.status(400).json({
        success: false,
        error: ERROR_MESSAGES.MISSING_PROJECT_NAME,
      });
    }

    // 解析文档类型
    const documentType = parseDocumentType(type);

    // 构建上传请求
    const uploadRequest: UploadDocumentRequest = {
      content,
      type: documentType,
      project_name,
      title,
      metadata,
    };

    // 处理文档上传
    console.log(
      `${LOG_MESSAGES.PROCESSING_DOCUMENT}: 项目=${project_name}, 类型=${documentType}`
    );

    const result = await documentService.uploadDocument(
      uploadRequest,
      (stage, current, total) => {
        console.log(`[${stage}] ${current}/${total}`);
      }
    );

    console.log(
      `${LOG_MESSAGES.DOCUMENT_UPLOAD_COMPLETE}: ${result.document_id}`
    );

    return res.status(201).json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error(LOG_MESSAGES.DOCUMENT_UPLOAD_FAILED, error);
    next(error);
  }
}

/**
 * 获取文档详情
 * GET /api/documents/:id
 */
export async function getDocument(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: ERROR_MESSAGES.MISSING_DOCUMENT_ID,
      });
    }

    const document = await documentService.getDocument(id);

    if (!document) {
      return res.status(404).json({
        success: false,
        error: ERROR_MESSAGES.DOCUMENT_NOT_FOUND,
      });
    }

    return res.json({
      success: true,
      data: document,
    });
  } catch (error) {
    console.error(LOG_MESSAGES.GET_DOCUMENT_FAILED, error);
    next(error);
  }
}

/**
 * 获取项目的文档列表
 * GET /api/documents?project_name=xxx
 */
export async function getDocumentsByProject(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { project_name } = req.query;

    if (!project_name || typeof project_name !== "string") {
      return res.status(400).json({
        success: false,
        error: ERROR_MESSAGES.MISSING_QUERY_PROJECT_NAME,
      });
    }

    const documents = await documentService.getDocumentsByProject(project_name);

    return res.json({
      success: true,
      data: documents,
    });
  } catch (error) {
    console.error(LOG_MESSAGES.GET_DOCUMENT_LIST_FAILED, error);
    next(error);
  }
}

/**
 * 删除文档
 * DELETE /api/documents/:id
 */
export async function deleteDocument(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: ERROR_MESSAGES.MISSING_DOCUMENT_ID,
      });
    }

    const deleted = await documentService.deleteDocument(id);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: ERROR_MESSAGES.DOCUMENT_NOT_FOUND,
      });
    }

    return res.json({
      success: true,
      message: SUCCESS_MESSAGES.DOCUMENT_DELETED,
    });
  } catch (error) {
    console.error(LOG_MESSAGES.DELETE_DOCUMENT_FAILED, error);
    next(error);
  }
}

/**
 * 检索文档
 * POST /api/documents/search
 *
 * 请求体:
 * {
 *   "query": "检索关键词",
 *   "project_name": "项目名称（可选，不提供则全局检索）",
 *   "top_k": 10,（可选，默认10）
 *   "similarity_threshold": 0.5（可选，默认0.5）
 * }
 */
export async function searchDocuments(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { query, project_name, top_k, similarity_threshold, use_hyde } =
      req.body;

    // 参数验证
    if (!query || typeof query !== "string") {
      return res.status(400).json({
        success: false,
        error: ERROR_MESSAGES.MISSING_QUERY,
      });
    }

    // 构建检索请求
    const searchRequest: SearchDocumentRequest = {
      query,
      project_name,
      top_k: top_k ? Number(top_k) : undefined,
      use_hyde: use_hyde === true,
      similarity_threshold: similarity_threshold
        ? Number(similarity_threshold)
        : undefined,
    };

    console.log(
      `${LOG_MESSAGES.SEARCHING_DOCUMENTS}: 关键词="${query}", 项目=${
        project_name || "全局"
      }`
    );

    const result = await documentService.searchDocuments(searchRequest);

    console.log(
      `${LOG_MESSAGES.SEARCH_COMPLETE}: 找到 ${result.total_results} 条结果`
    );

    return res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error(LOG_MESSAGES.SEARCH_FAILED, error);
    next(error);
  }
}
