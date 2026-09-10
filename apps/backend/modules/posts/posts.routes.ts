// HTTP API модуля постов.
import { Router } from 'express';
import type { Request, Response } from 'express';
import { asyncHandler } from '../../lib/http';
import { log } from '../../lib/logger';
import { requireAuth } from '../auth/auth.middleware';
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
import { renderMarkdown } from './markdown';

export const postsRouter = Router();
postsRouter.use(requireAuth);

// Предпросмотр Markdown: рендер и санитизация на сервере (без сохранения).
postsRouter.post(
  '/preview',
  asyncHandler(async (req: Request, res: Response) => {
    const content = typeof req.body?.content === 'string' ? req.body.content : '';
    res.json({ html: renderMarkdown(content) });
  }),
);

postsRouter.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const posts = await listPosts(req.user as CurrentUser);
    res.json({ posts });
  }),
);

postsRouter.get(
  '/:postId',
  asyncHandler(async (req: Request, res: Response) => {
    const postId = parsePostId(req.params.postId);
    const post = await getPostOrThrow(req.user as CurrentUser, postId);
    res.json({ post });
  }),
);

postsRouter.post(
  '/',
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
  asyncHandler(async (req: Request, res: Response) => {
    const actor = req.user as CurrentUser;
    const attachment = await uploadPostAttachment(req, actor, req.params.postId);
    res.status(201).json({ file: attachment });
  }),
);

postsRouter.get(
  '/:postId/files',
  asyncHandler(async (req: Request, res: Response) => {
    const actor = req.user as CurrentUser;
    const files = await listPostAttachments(actor, req.params.postId);
    res.json({ files });
  }),
);

postsRouter.get(
  '/:postId/files/:fileId/download',
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
  asyncHandler(async (req: Request, res: Response) => {
    const actor = req.user as CurrentUser;
    await deletePostAttachment(actor, req.params.postId, req.params.fileId);
    res.json({ ok: true });
  }),
);
