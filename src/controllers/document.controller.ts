import { Request, Response, NextFunction } from "express";
import { DocumentType } from "@prisma/client";
import { DocumentService, UploadDocumentRequest } from "../services";
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
 *   "projectName": "项目名称",
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
    const { content, type, projectName, title, metadata } = req.body;

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

    if (!projectName || typeof projectName !== "string") {
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
      projectName,
      title,
      metadata,
    };

    // 处理文档上传
    console.log(
      `${LOG_MESSAGES.PROCESSING_DOCUMENT}: 项目=${projectName}, 类型=${documentType}`
    );

    const result = await documentService.uploadDocument(
      uploadRequest,
      (stage, current, total) => {
        console.log(`[${stage}] ${current}/${total}`);
      }
    );

    console.log(
      `${LOG_MESSAGES.DOCUMENT_UPLOAD_COMPLETE}: ${result.documentId}`
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
 * GET /api/documents?projectName=xxx
 */
export async function getDocumentsByProject(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { projectName } = req.query;

    if (!projectName || typeof projectName !== "string") {
      return res.status(400).json({
        success: false,
        error: ERROR_MESSAGES.MISSING_QUERY_PROJECT_NAME,
      });
    }

    const documents = await documentService.getDocumentsByProject(projectName);

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
