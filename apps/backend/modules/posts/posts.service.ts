// Бизнес-логика модуля постов (лента новостей).
//
// Жизненный цикл публикации (статусы вычисляются, а не хранятся — см. PostStatus):
//   draft      — черновик: виден только администратору;
//   scheduled  — отложенная: is_published = true, scheduled_at в будущем;
//   published  — опубликована: видна в публичной ленте;
//   archived   — в архиве: скрыта из ленты, но доступна администратору.
import { PostStatus, RoleType, isPostStatus } from '@arbuz/shared';
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

/** Фильтр `?status=` админского списка (неизвестное значение → undefined = без фильтра). */
export function parsePostStatus(raw: unknown): PostStatus | undefined {
  if (typeof raw !== 'string' || !raw) return undefined;
  return isPostStatus(raw) ? raw : undefined;
}

export interface PostInput {
  title: string;
  content: string;
  is_published?: boolean;
  /** Скрывать автора публикации в ленте. */
  hide_author?: boolean;
  /** ISO-дата отложенной публикации; задана → публикация «Запланирована». */
  scheduled_at?: string | null;
  /** Поместить публикацию в архив (`true`) или вернуть из архива (`false`). */
  archived?: boolean;
  /** Закрепить публикацию наверху ленты. */
  pinned?: boolean;
  /** Ручной порядок отображения внутри группы (меньше — выше). */
  sort_order?: number;
}

interface ValidatedPostInput {
  title: string;
  content: string;
  is_published: boolean;
  hide_author: boolean;
  scheduled_at: Date | null;
  archived: boolean;
  pinned: boolean;
  sort_order: number;
}

/** Разбор ручного порядка: целое число (пусто → 0). */
function parseSortOrder(raw: unknown): number {
  if (raw === undefined || raw === null || raw === '') return 0;
  const value = Number(raw);
  if (!Number.isFinite(value) || !Number.isInteger(value)) {
    throw httpError(400, 'Порядок отображения должен быть целым числом', 'INVALID_SORT_ORDER');
  }
  return value;
}

/** Разбор даты отложенной публикации (пусто → null). */
function parseScheduledAt(raw: unknown): Date | null {
  if (raw === undefined || raw === null || raw === '') return null;
  const date = new Date(String(raw));
  if (Number.isNaN(date.getTime())) {
    throw httpError(400, 'Некорректная дата отложенной публикации', 'INVALID_SCHEDULED_AT');
  }
  return date;
}

function validateInput(input: Partial<PostInput> & { title?: string; content?: string }): ValidatedPostInput {
  const title = String(input.title ?? '').trim();
  const content = String(input.content ?? '');
  if (!title || !content) throw httpError(400, 'Укажите title и content поста', 'INVALID_BODY');
  if (title.length > POST_TITLE_MAX) {
    throw httpError(400, `Заголовок длиннее ${POST_TITLE_MAX} символов`, 'TITLE_TOO_LONG');
  }
  if (content.length > POST_CONTENT_MAX) {
    throw httpError(400, `Содержимое длиннее ${POST_CONTENT_MAX} символов`, 'CONTENT_TOO_LONG');
  }
  const scheduledAt = parseScheduledAt(input.scheduled_at);
  return {
    title,
    content,
    // Отложенная публикация всегда помечена опубликованной: до наступления даты
    // статус вычисляется как «Запланирована», после — как «Опубликована».
    is_published: scheduledAt ? true : Boolean(input.is_published),
    hide_author: Boolean(input.hide_author),
    scheduled_at: scheduledAt,
    archived: Boolean(input.archived),
    pinned: Boolean(input.pinned),
    sort_order: parseSortOrder(input.sort_order),
  };
}

type PostStatusSource = {
  is_published: boolean;
  scheduled_at: Date | null;
  archived_at: Date | null;
};

/** Вычисляет статус публикации по её полям (без фонового воркера). */
export function computePostStatus(post: PostStatusSource, now: Date = new Date()): PostStatus {
  if (post.archived_at) return PostStatus.archived;
  if (post.scheduled_at && post.scheduled_at > now) return PostStatus.scheduled;
  return post.is_published ? PostStatus.published : PostStatus.draft;
}

/** Условие выборки для публичной ленты: опубликованные, не архив, не отложенные. */
function publishedWhere(now: Date) {
  return {
    is_published: true,
    archived_at: null,
    OR: [{ scheduled_at: null }, { scheduled_at: { lte: now } }],
  };
}

/** Условие выборки по вычисляемому статусу (админский список). */
function statusWhere(status: PostStatus, now: Date) {
  switch (status) {
    case PostStatus.draft:
      return { is_published: false, archived_at: null };
    case PostStatus.scheduled:
      return { is_published: true, archived_at: null, scheduled_at: { gt: now } };
    case PostStatus.published:
      return publishedWhere(now);
    case PostStatus.archived:
      return { archived_at: { not: null } };
  }
}

export interface PostAttachment {
  id: number;
  name: string;
  fileType: string | null;
}

export interface PostData {
  id: number;
  title: string;
  content: string;
  contentHtml: string;
  /** Вычисляемый статус: draft | scheduled | published | archived. */
  status: PostStatus;
  hideAuthor: boolean;
  /** Дата отложенной публикации. */
  scheduledAt: Date | null;
  /** Дата архивации (null — не в архиве). */
  archivedAt: Date | null;
  /** Когда менялось содержимое (заголовок/текст) — для пометки «Отредактировано». */
  editedAt: Date | null;
  /** Закрепление в ленте: закреплённые идут первыми. */
  pinned: boolean;
  /** Ручной порядок отображения внутри группы. */
  sortOrder: number;
  createdBy: number | null;
  /** Имя автора; `null`, если автор скрыт или удалён. */
  authorName: string | null;
  createdAt: Date;
  updatedAt: Date;
  attachments: PostAttachment[];
}

type PostWithAuthor = PostStatusSource & {
  id: number;
  title: string;
  content: string;
  hide_author: boolean;
  edited_at: Date | null;
  pinned: boolean;
  sort_order: number;
  created_by: number | null;
  created_at: Date;
  updated_at: Date;
  author: { surname: string | null; name: string | null } | null;
  posts_files: Array<{ files: { id: number; name: string; file_type: string | null } }>;
};

/**
 * Идентификаторы файлов, вставленных в текст как изображения
 * (`/api/posts/<id>/files/<fileId>/download`).
 */
export function inlineFileIds(content: string): Set<number> {
  const ids = new Set<number>();
  for (const match of content.matchAll(/\/posts\/\d+\/files\/(\d+)\/download/g)) {
    ids.add(Number(match[1]));
  }
  return ids;
}

function serialize(post: PostWithAuthor): PostData {
  const authorName =
    !post.hide_author && post.author && (post.author.name || post.author.surname)
      ? [post.author.name, post.author.surname].filter(Boolean).join(' ')
      : null;
  // Картинки, вставленные в текст, показываются в тексте — в списке вложений их не дублируем.
  const inlineIds = inlineFileIds(post.content);
  return {
    id: post.id,
    title: post.title,
    content: post.content,
    contentHtml: renderMarkdown(post.content),
    status: computePostStatus(post),
    hideAuthor: post.hide_author,
    scheduledAt: post.scheduled_at,
    archivedAt: post.archived_at,
    editedAt: post.edited_at,
    pinned: post.pinned,
    sortOrder: post.sort_order,
    createdBy: post.created_by,
    authorName,
    createdAt: post.created_at,
    updatedAt: post.updated_at,
    // Вложения отдаём вместе с постом: лента показывает их без дополнительных запросов.
    attachments: post.posts_files
      .filter((link) => !inlineIds.has(link.files.id))
      .map((link) => ({
        id: link.files.id,
        name: link.files.name,
        fileType: link.files.file_type,
      })),
  };
}

const authorSelect = { select: { name: true, surname: true } } as const;

/** Единый набор полей поста (включая вложения) для всех операций чтения. */
const postSelect = {
  id: true,
  title: true,
  content: true,
  is_published: true,
  hide_author: true,
  scheduled_at: true,
  archived_at: true,
  edited_at: true,
  pinned: true,
  sort_order: true,
  created_by: true,
  created_at: true,
  updated_at: true,
  author: authorSelect,
  posts_files: {
    where: { files: { deleted_at: null } },
    orderBy: { created_at: 'asc' },
    select: { files: { select: { id: true, name: true, file_type: true } } },
  },
} as const;

export interface PostPage {
  posts: PostData[];
  total: number;
}

/**
 * Публичная лента: только опубликованные посты.
 * Черновики, архив и отложенные не отдаются никому — в том числе администратору
 * (они доступны только в разделе «Публикации»).
 */
export async function listPublishedPosts(filter: {
  limit: number;
  offset: number;
  search?: string;
}): Promise<PostPage> {
  const where = {
    deleted_at: null,
    ...publishedWhere(new Date()),
    ...(filter.search ? { title: { contains: filter.search, mode: 'insensitive' as const } } : {}),
  };
  const [posts, total] = await Promise.all([
    prisma.posts.findMany({
      where,
      // Закреплённые — первыми, далее по ручному порядку, при равенстве — новые выше.
      orderBy: [{ pinned: 'desc' }, { sort_order: 'asc' }, { created_at: 'desc' }],
      skip: filter.offset,
      take: filter.limit,
      select: postSelect,
    }),
    prisma.posts.count({ where }),
  ]);
  return { posts: posts.map(serialize), total };
}

/** Список для раздела «Публикации»: все статусы, с фильтром по статусу. Доступ — админ. */
export async function listPostsForAdmin(
  user: CurrentUser,
  filter: { limit: number; offset: number; search?: string; status?: PostStatus },
): Promise<PostPage> {
  requireAdmin(user);
  const where = {
    deleted_at: null,
    ...(filter.status ? statusWhere(filter.status, new Date()) : {}),
    ...(filter.search ? { title: { contains: filter.search, mode: 'insensitive' as const } } : {}),
  };
  const [posts, total] = await Promise.all([
    prisma.posts.findMany({
      where,
      orderBy: [{ pinned: 'desc' }, { sort_order: 'asc' }, { created_at: 'desc' }],
      skip: filter.offset,
      take: filter.limit,
      select: postSelect,
    }),
    prisma.posts.count({ where }),
  ]);
  return { posts: posts.map(serialize), total };
}

/** Чтение поста: администратор — любой, остальные — только опубликованный. */
export async function getPostOrThrow(user: CurrentUser | undefined, postId: number) {
  const post = await prisma.posts.findUnique({
    where: { id: postId },
    select: { ...postSelect, deleted_at: true },
  });
  const visible = post && !post.deleted_at && (isAdmin(user) || computePostStatus(post) === PostStatus.published);
  if (!post || !visible) {
    throw httpError(404, 'Пост не найден', 'POST_NOT_FOUND');
  }
  return serialize(post);
}

export async function createPost(user: CurrentUser, input: Partial<PostInput>) {
  requireAdmin(user);
  const data = validateInput(input);
  const post = await prisma.posts.create({
    data: {
      title: data.title,
      content: data.content,
      is_published: data.is_published,
      hide_author: data.hide_author,
      scheduled_at: data.scheduled_at,
      archived_at: data.archived ? new Date() : null,
      pinned: data.pinned,
      sort_order: data.sort_order,
      created_by: user.id,
    },
    select: postSelect,
  });
  return serialize(post);
}

export async function updatePost(user: CurrentUser, postId: number, input: Partial<PostInput>) {
  requireAdmin(user);
  const existing = await prisma.posts.findFirst({
    where: { id: postId, deleted_at: null },
    select: { id: true, title: true, content: true, archived_at: true },
  });
  if (!existing) throw httpError(404, 'Пост не найден', 'POST_NOT_FOUND');

  const data = validateInput(input);
  // Пометка «Отредактировано» — только при изменении содержимого, не флагов/статуса.
  const contentChanged = existing.title !== data.title || existing.content !== data.content;
  const post = await prisma.posts.update({
    where: { id: postId },
    data: {
      title: data.title,
      content: data.content,
      is_published: data.is_published,
      hide_author: data.hide_author,
      scheduled_at: data.scheduled_at,
      // Повторная архивация сохраняет исходную дату.
      archived_at: data.archived ? existing.archived_at ?? new Date() : null,
      pinned: data.pinned,
      sort_order: data.sort_order,
      ...(contentChanged ? { edited_at: new Date() } : {}),
    },
    select: postSelect,
  });
  return serialize(post);
}

export async function deletePost(user: CurrentUser, postId: number): Promise<void> {
  requireAdmin(user);
  const existing = await prisma.posts.findFirst({ where: { id: postId, deleted_at: null }, select: { id: true } });
  if (!existing) throw httpError(404, 'Пост не найден', 'POST_NOT_FOUND');
  await prisma.posts.update({ where: { id: postId }, data: { deleted_at: new Date() } });
}
