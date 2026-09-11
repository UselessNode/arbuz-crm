// Бизнес-логика модуля постов (лента новостей).
import { RoleType } from '@arbuz/shared';
import { prisma } from '../../lib/prisma';
import { httpError } from '../../lib/http';
import type { CurrentUser } from '../files/files.service';
import { renderMarkdown } from './markdown';

export const POST_TITLE_MAX = 255;
export const POST_CONTENT_MAX = 1_000_000;

export function isAdmin(user: CurrentUser | undefined): boolean {
  return user?.role === RoleType.admin;
}

function requireAdmin(user: CurrentUser): void {
  if (!isAdmin(user)) {
    throw httpError(403, 'Действие доступно только администратору', 'FORBIDDEN');
  }
}

export function parsePostId(raw: string | undefined): number {
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) {
    throw httpError(400, 'Некорректный идентификатор', 'INVALID_ID');
  }
  return value;
}

export interface PostInput {
  title: string;
  content: string;
  is_published?: boolean;
}

function validateInput(input: Partial<PostInput> & { title?: string; content?: string }): {
  title: string;
  content: string;
  is_published: boolean;
} {
  const title = String(input.title ?? '').trim();
  const content = String(input.content ?? '');
  if (!title || !content) throw httpError(400, 'Укажите title и content поста', 'INVALID_BODY');
  if (title.length > POST_TITLE_MAX) {
    throw httpError(400, `Заголовок длиннее ${POST_TITLE_MAX} символов`, 'TITLE_TOO_LONG');
  }
  if (content.length > POST_CONTENT_MAX) {
    throw httpError(400, `Содержимое длиннее ${POST_CONTENT_MAX} символов`, 'CONTENT_TOO_LONG');
  }
  return { title, content, is_published: Boolean(input.is_published) };
}

export interface PostData {
  id: number;
  title: string;
  content: string;
  contentHtml: string;
  is_published: boolean;
  createdBy: number | null;
  authorName: string | null;
  createdAt: Date;
  updatedAt: Date;
}

type PostWithAuthor = {
  id: number;
  title: string;
  content: string;
  is_published: boolean;
  created_by: number | null;
  created_at: Date;
  updated_at: Date;
  author: { surname: string | null; name: string | null } | null;
};

function serialize(post: PostWithAuthor): PostData {
  const authorName =
    post.author && (post.author.name || post.author.surname)
      ? [post.author.name, post.author.surname].filter(Boolean).join(' ')
      : null;
  return {
    id: post.id,
    title: post.title,
    content: post.content,
    contentHtml: renderMarkdown(post.content),
    is_published: post.is_published,
    createdBy: post.created_by,
    authorName,
    createdAt: post.created_at,
    updatedAt: post.updated_at,
  };
}

const authorSelect = { select: { name: true, surname: true } } as const;

export async function listPosts(
  user: CurrentUser | undefined,
  filter: { limit: number; offset: number; search?: string; isPublished?: boolean },
): Promise<{ posts: PostData[]; total: number }> {
  const admin = isAdmin(user);
  const where = {
    deleted_at: null,
    ...(admin ? {} : { is_published: true }),
    // Фильтр по статусу публикации доступен только администратору.
    ...(admin && filter.isPublished !== undefined ? { is_published: filter.isPublished } : {}),
    ...(filter.search ? { title: { contains: filter.search, mode: 'insensitive' as const } } : {}),
  };
  const [posts, total] = await Promise.all([
    prisma.posts.findMany({
      where,
      orderBy: { created_at: 'desc' },
      skip: filter.offset,
      take: filter.limit,
      select: {
        id: true,
        title: true,
        content: true,
        is_published: true,
        created_by: true,
        created_at: true,
        updated_at: true,
        author: authorSelect,
      },
    }),
    prisma.posts.count({ where }),
  ]);
  return { posts: posts.map(serialize), total };
}

/** Чтение поста: администратор — любой, остальные — только опубликованный. */
export async function getPostOrThrow(user: CurrentUser | undefined, postId: number) {
  const post = await prisma.posts.findUnique({
    where: { id: postId },
    select: {
      id: true,
      title: true,
      content: true,
      is_published: true,
      created_by: true,
      created_at: true,
      updated_at: true,
      deleted_at: true,
      author: authorSelect,
    },
  });
  if (!post || post.deleted_at || (!post.is_published && !isAdmin(user))) {
    throw httpError(404, 'Пост не найден', 'POST_NOT_FOUND');
  }
  return serialize(post);
}

export async function createPost(user: CurrentUser, input: Partial<PostInput>) {
  requireAdmin(user);
  const data = validateInput(input);
  const post = await prisma.posts.create({
    data: { title: data.title, content: data.content, is_published: data.is_published, created_by: user.id },
    select: {
      id: true,
      title: true,
      content: true,
      is_published: true,
      created_by: true,
      created_at: true,
      updated_at: true,
      author: authorSelect,
    },
  });
  return serialize(post);
}

export async function updatePost(user: CurrentUser, postId: number, input: Partial<PostInput>) {
  requireAdmin(user);
  const existing = await prisma.posts.findFirst({ where: { id: postId, deleted_at: null }, select: { id: true } });
  if (!existing) throw httpError(404, 'Пост не найден', 'POST_NOT_FOUND');

  const data = validateInput(input);
  const post = await prisma.posts.update({
    where: { id: postId },
    data: { title: data.title, content: data.content, is_published: data.is_published },
    select: {
      id: true,
      title: true,
      content: true,
      is_published: true,
      created_by: true,
      created_at: true,
      updated_at: true,
      author: authorSelect,
    },
  });
  return serialize(post);
}

export async function deletePost(user: CurrentUser, postId: number): Promise<void> {
  requireAdmin(user);
  const existing = await prisma.posts.findFirst({ where: { id: postId, deleted_at: null }, select: { id: true } });
  if (!existing) throw httpError(404, 'Пост не найден', 'POST_NOT_FOUND');
  await prisma.posts.update({ where: { id: postId }, data: { deleted_at: new Date() } });
}
