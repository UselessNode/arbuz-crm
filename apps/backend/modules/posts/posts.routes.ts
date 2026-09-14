// HTTP API модуля постов.
// `GET /api/posts/feed` — публичная лента (только опубликованные);
// `GET /api/posts` — список раздела «Публикации» (админ, все статусы).
// Создание/правка/удаление и вложения — только авторизованным (админ — в сервисе).
import { Router } from 'express';
import type { Request, Response } from 'express';
import { asyncHandler } from '../../lib/http';
import { log } from '../../lib/logger';
import { parseLimitOffset, parseSearch } from '../../lib/query';
import { optionalAuth, requireAuth } from '../auth/auth.middleware';
import type { CurrentUser } from '../files/files.service';
import {
  createPost,
  deletePost,
  getPostOrThrow,
  listPostsForAdmin,
  listPublishedPosts,
  parsePostId,
  parsePostStatus,
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

// Предпросмотр Markdown больше не нужен: содержание редактируется WYSIWYG-редактором
// во фронтенде, а HTML для показа рендерит и санитизирует сервис (contentHtml).

// Публичная лента: только опубликованные посты. Черновики, архив и отложенные
// публикации здесь не показываются никому — даже администратору (они — в разделе «Публикации»).
postsRouter.get(
  '/feed',
  asyncHandler(async (req: Request, res: Response) => {
    const { limit, offset } = parseLimitOffset(req.query);
    const search = parseSearch(req.query);
    const result = await listPublishedPosts({ search, limit, offset });
    res.json(result);
  }),
);

// Список раздела «Публикации»: все статусы, фильтр ?status=. Доступ — администратору.
postsRouter.get(
  '/',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const { limit, offset } = parseLimitOffset(req.query);
    const search = parseSearch(req.query);
    const status = parsePostStatus(req.query.status);
    const result = await listPostsForAdmin(req.user as CurrentUser, { search, status, limit, offset });
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
      hide_author: req.body?.hide_author,
      scheduled_at: req.body?.scheduled_at,
      archived: req.body?.archived,
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
      hide_author: req.body?.hide_author,
      scheduled_at: req.body?.scheduled_at,
      archived: req.body?.archived,
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

// Вложения опубликованного поста доступны и гостям (публичная лента новостей);
// для черновика доступ проверяет сервис (requireVisiblePost).
postsRouter.get(
  '/:postId/files/:fileId/download',
  asyncHandler(async (req: Request, res: Response) => {
    const actor = req.user as CurrentUser | undefined;
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
