// Вложения постов: физический файл (через модуль files) + связь posts_files.
import { prisma } from '../../lib/prisma';
import { httpError } from '../../lib/http';
import { log } from '../../lib/logger';
import { readMultipartFile } from '../../lib/multipart';
import type { CurrentUser } from '../files/files.service';
import { safeOriginalName, validateUpload } from '../files/file-validation';
import { openStored, removeStored, storeUpload } from '../files/file-storage';
import { isAdmin } from './posts.service';
import type { Request } from 'express';

export { applyDownloadHeaders } from '../files/download';

function requireAdmin(user: CurrentUser): void {
  if (!isAdmin(user)) throw httpError(403, 'Действие доступно только администратору', 'FORBIDDEN');
}

/** Проверка видимости поста: опубликован для всех (в т.ч. гостей), черновик — только админу. */
async function requireVisiblePost(user: CurrentUser | undefined, postId: number) {
  const post = await prisma.posts.findFirst({
    where: { id: postId, deleted_at: null },
    select: { id: true, is_published: true },
  });
  if (!post || (!post.is_published && !isAdmin(user))) {
    throw httpError(404, 'Пост не найден', 'POST_NOT_FOUND');
  }
  return post;
}

function parseId(raw: string | undefined): number {
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) {
    throw httpError(400, 'Некорректный идентификатор', 'INVALID_ID');
  }
  return value;
}

interface FileMeta {
  id: number;
  name: string;
  fileType: string | null;
  createdAt: Date;
}

export async function uploadPostAttachment(
  req: Request,
  user: CurrentUser,
  rawPostId: string | undefined,
) {
  requireAdmin(user);
  const postId = parseId(rawPostId);
  const post = await prisma.posts.findFirst({ where: { id: postId, deleted_at: null }, select: { id: true } });
  if (!post) throw httpError(404, 'Пост не найден', 'POST_NOT_FOUND');

  const { buffer, originalName } = await readMultipartFile(req);
  const type = validateUpload(buffer, originalName);
  const relativePath = await storeUpload(buffer, `posts/${postId}`, type);

  const file = await prisma.files.create({
    data: {
      name: safeOriginalName(originalName).slice(0, 100),
      file_type: type,
      path: relativePath,
    },
  });
  await prisma.posts_files.createMany({ data: [{ post_id: postId, file_id: file.id }], skipDuplicates: true });

  log.audit('posts.attachment.upload', { userId: user.id, postId, fileId: file.id, fileName: file.name });
  const meta: FileMeta = { id: file.id, name: file.name, fileType: file.file_type, createdAt: file.created_at };
  return meta;
}

export async function listPostAttachments(user: CurrentUser, rawPostId: string | undefined) {
  const postId = parseId(rawPostId);
  await requireVisiblePost(user, postId);

  const links = await prisma.posts_files.findMany({
    where: { post_id: postId, files: { deleted_at: null } },
    select: { files: { select: { id: true, name: true, file_type: true, created_at: true } } },
    orderBy: { created_at: 'asc' },
  });
  const items: FileMeta[] = links.map((link) => ({
    id: link.files.id,
    name: link.files.name,
    fileType: link.files.file_type,
    createdAt: link.files.created_at,
  }));
  return items;
}

export async function downloadPostAttachment(
  user: CurrentUser | undefined,
  rawPostId: string | undefined,
  rawFileId: string | undefined,
) {
  const postId = parseId(rawPostId);
  const fileId = parseId(rawFileId);
  await requireVisiblePost(user, postId);

  const file = await prisma.files.findFirst({
    where: { id: fileId, deleted_at: null, posts_files: { some: { post_id: postId } } },
  });
  if (!file || !file.path) throw httpError(404, 'Файл не найден', 'FILE_NOT_FOUND');
  const { stream, size } = await openStored(file.path);
  return { stream, size, file };
}

export async function deletePostAttachment(user: CurrentUser, rawPostId: string | undefined, rawFileId: string | undefined) {
  requireAdmin(user);
  const postId = parseId(rawPostId);
  const fileId = parseId(rawFileId);

  const file = await prisma.files.findFirst({
    where: { id: fileId, deleted_at: null, posts_files: { some: { post_id: postId } } },
  });
  if (!file || !file.path) throw httpError(404, 'Файл не найден', 'FILE_NOT_FOUND');

  await prisma.posts_files.deleteMany({ where: { post_id: postId, file_id: fileId } });
  await prisma.files.update({ where: { id: fileId }, data: { deleted_at: new Date() } });
  await removeStored(file.path);
  log.audit('posts.attachment.delete', { userId: user.id, postId, fileId });
}
