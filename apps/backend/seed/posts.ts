// Публикации seed: статус раскладывается на поля posts (is_published/scheduled_at/archived_at).
import { prisma } from '../lib/prisma';
import type { SeedPost } from './data';

/** Сдвиг даты на N дней (без времени суток). */
function shiftDays(days: number): Date {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
}

/** Поля публикации, соответствующие её статусу. */
function statusFields(post: SeedPost) {
  return {
    is_published: post.status !== 'draft',
    scheduled_at: post.status === 'scheduled' ? shiftDays(post.scheduledInDays ?? 1) : null,
    archived_at: post.status === 'archived' ? new Date() : null,
    edited_at: post.editedDaysAgo !== undefined ? shiftDays(-post.editedDaysAgo) : null,
  };
}

/** Создаёт публикацию, если её ещё нет (идемпотентно по заголовку). */
export async function ensurePost(post: SeedPost, authorId: number): Promise<void> {
  const existing = await prisma.posts.findFirst({ where: { title: post.title, deleted_at: null }, select: { id: true } });
  if (existing) return;
  await prisma.posts.create({
    data: {
      title: post.title,
      content: post.content,
      hide_author: post.hideAuthor ?? false,
      pinned: post.pinned ?? false,
      sort_order: post.sortOrder ?? 0,
      created_by: authorId,
      ...statusFields(post),
    },
  });
}
