// HTTP API модуля постов.
// Чтение опубликованных постов доступно без авторизации (публичная лента);
// создание/правка/удаление и вложения — только авторизованным (админ — в сервисе).
import { Router } from 'express';
import type { Request, Response } from 'express';
import { asyncHandler } from '../../lib/http';
import { log } from '../../lib/logger';
import { optionalAuth, requireAuth } from '../auth/auth.middleware';
import type { CurrentUser } from '../files/files.service';
import {
  createPost,
  deletePost,
  getPostOrThrow,
  listPosts,
  parsePostId,
  updatePost,
} from './posts.service';
import {
  applyDownloadHeaders,
  deletePostAttachment,
  downloadPostAttachment,
  listPostAttachments,
  uploadPostAttachment,
} from './posts.attachments';

export const postsRouter = Router();
postsRouter.use(optionalAuth);

function parseLimitOffset(query: Request['query']): { limit: number; offset: number } {
  const limit = Number(query.limit ?? 20);
  const offset = Number(query.offset ?? 0);
  return {
    limit: Number.isFinite(limit) ? Math.min(Math.max(Math.trunc(limit), 1), 100) : 20,
    offset: Number.isFinite(offset) ? Math.max(Math.trunc(offset), 0) : 0,
  };
}

// Предпросмотр Markdown больше не нужен: содержание редактируется WYSIWYG-редактором
// во фронтенде, а HTML для показа рендерит и санитизирует сервис (contentHtml).

// Публичная лента: гость видит только опубликованные посты.
postsRouter.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const { limit, offset } = parseLimitOffset(req.query);
    const result = await listPosts(req.user as CurrentUser | undefined, { limit, offset });
    res.json(result);
  }),
);

postsRouter.get(
  '/:postId',
  asyncHandler(async (req: Request, res: Response) => {
    const postId = parsePostId(req.params.postId);
    const post = await getPostOrThrow(req.user as CurrentUser | undefined, postId);
    res.json({ post });
  }),
);

postsRouter.post(
  '/',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const actor = req.user as CurrentUser;
    const post = await createPost(actor, {
      title: req.body?.title,
      content: req.body?.content,
      is_published: req.body?.is_published,
    });
    log.audit('posts.create', { userId: actor.id, postId: post.id, title: post.title });
    res.status(201).json({ post });
  }),
);

postsRouter.patch(
  '/:postId',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const actor = req.user as CurrentUser;
    const postId = parsePostId(req.params.postId);
    const post = await updatePost(actor, postId, {
      title: req.body?.title,
      content: req.body?.content,
      is_published: req.body?.is_published,
    });
    log.audit('posts.update', { userId: actor.id, postId: post.id });
    res.json({ post });
  }),
);

postsRouter.delete(
  '/:postId',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const actor = req.user as CurrentUser;
    const postId = parsePostId(req.params.postId);
    await deletePost(actor, postId);
    log.audit('posts.delete', { userId: actor.id, postId });
    res.json({ ok: true });
  }),
);

// --- Вложения поста (через модуль files) ---

postsRouter.post(
  '/:postId/files',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const actor = req.user as CurrentUser;
    const attachment = await uploadPostAttachment(req, actor, req.params.postId);
    res.status(201).json({ file: attachment });
  }),
);

postsRouter.get(
  '/:postId/files',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const actor = req.user as CurrentUser;
    const files = await listPostAttachments(actor, req.params.postId);
    res.json({ files });
  }),
);

postsRouter.get(
  '/:postId/files/:fileId/download',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const actor = req.user as CurrentUser;
    const { stream, size, file } = await downloadPostAttachment(actor, req.params.postId, req.params.fileId);
    applyDownloadHeaders(res, file.name, file.file_type, size);
    stream.on('error', () => res.destroy());
    res.on('close', () => stream.destroy());
    stream.pipe(res);
  }),
);

postsRouter.delete(
  '/:postId/files/:fileId',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const actor = req.user as CurrentUser;
    await deletePostAttachment(actor, req.params.postId, req.params.fileId);
    res.json({ ok: true });
  }),
);
