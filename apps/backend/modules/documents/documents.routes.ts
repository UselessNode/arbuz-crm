// HTTP API публичных документов.
// Публично: список опубликованных и скачивание. Только администратору: полный список и изменения.
import { Router } from 'express';
import type { Request, Response } from 'express';
import { asyncHandler } from '../../lib/http';
import { log } from '../../lib/logger';
import { parseId } from '../../lib/parse';
import { optionalAuth, requireAuth } from '../auth/auth.middleware';
import { applyDownloadHeaders } from '../files/download';
import type { CurrentUser } from '../files/files.service';
import {
  createDocument,
  deleteDocument,
  downloadDocument,
  listManagedDocuments,
  listPublicDocuments,
  updateDocument,
} from './documents.service';

export const documentsRouter = Router();
documentsRouter.use(optionalAuth);

// Публичный список документов для домашней страницы.
documentsRouter.get(
  '/feed',
  asyncHandler(async (_req: Request, res: Response) => {
    const documents = await listPublicDocuments();
    res.json({ documents });
  }),
);

// Полный список для админки (включая снятые с публикации).
documentsRouter.get(
  '/',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const documents = await listManagedDocuments(req.user as CurrentUser);
    res.json({ documents });
  }),
);

// Загрузка нового документа (multipart): файл + title/description/sort_order/is_published.
documentsRouter.post(
  '/',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const actor = req.user as CurrentUser;
    const document = await createDocument(req, actor);
    log.audit('documents.create', { userId: actor.id, documentId: document.id, title: document.title });
    res.status(201).json({ document });
  }),
);

documentsRouter.patch(
  '/:documentId',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const actor = req.user as CurrentUser;
    const document = await updateDocument(actor, parseId(req.params.documentId), {
      title: req.body?.title,
      description: req.body?.description,
      sort_order: req.body?.sort_order,
      is_published: req.body?.is_published,
    });
    log.audit('documents.update', { userId: actor.id, documentId: document.id });
    res.json({ document });
  }),
);

documentsRouter.delete(
  '/:documentId',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const actor = req.user as CurrentUser;
    const documentId = parseId(req.params.documentId);
    await deleteDocument(actor, documentId);
    log.audit('documents.delete', { userId: actor.id, documentId });
    res.json({ ok: true });
  }),
);

// Скачивание: опубликованный документ доступен всем, снятый — только администратору.
documentsRouter.get(
  '/:documentId/download',
  asyncHandler(async (req: Request, res: Response) => {
    const actor = req.user as CurrentUser | undefined;
    const { stream, size, file } = await downloadDocument(actor, parseId(req.params.documentId));
    applyDownloadHeaders(res, file.name, file.file_type, size);
    stream.on('error', () => res.destroy());
    res.on('close', () => stream.destroy());
    stream.pipe(res);
  }),
);
