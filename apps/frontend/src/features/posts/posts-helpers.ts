import { PostStatuses } from '../../lib/post-status';
import type { PostStatus } from '@arbuz/shared';
import type { Post, PostPayload } from '../../api/posts';
import type { SelectOption, StatusOption } from '../../components/ui';

export const POST_STATUS_OPTIONS: readonly StatusOption<PostStatus>[] = [
  { value: PostStatuses.draft, label: 'Черновик', tone: 'gray' },
  { value: PostStatuses.scheduled, label: 'Запланирована', tone: 'yellow' },
  { value: PostStatuses.published, label: 'Опубликована', tone: 'green' },
  { value: PostStatuses.archived, label: 'В архиве', tone: 'neutral' },
];

export const POST_FILTER_OPTIONS: readonly SelectOption<PostStatus>[] = POST_STATUS_OPTIONS.map(
  (o) => ({ value: o.value, label: o.label }),
);

/** Полный payload: PATCH заменяет документ целиком, override задаёт изменения. */
export function buildPostPayload(post: Post, override: Partial<PostPayload> = {}): PostPayload {
  return {
    title: post.title,
    content: post.content,
    is_published: post.status !== PostStatuses.draft,
    hide_author: post.hideAuthor,
    scheduled_at: post.scheduledAt,
    archived: post.status === PostStatuses.archived,
    pinned: post.pinned,
    sort_order: post.sortOrder,
    ...override,
  };
}

/** Локальный порядок: закреплённые сверху, затем sortOrder, затем свежие выше. */
export function sortPosts(list: Post[]): Post[] {
  return [...list].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}

/**
 * Пересчёт sort_order после перестановки: внутри группы (pinned/unpinned),
 * sort_order = индекс. Возвращает только изменившиеся строки.
 */
export function reorderForDrop(
  list: Post[],
  draggedId: number,
  targetId: number,
): Array<{ id: number; sortOrder: number }> {
  const dragged = list.find((p) => p.id === draggedId);
  const target = list.find((p) => p.id === targetId);
  if (!dragged || !target || dragged.id === target.id) return [];
  if (dragged.pinned !== target.pinned) return [];

  const group = list.filter((p) => p.pinned === dragged.pinned);
  const from = group.findIndex((p) => p.id === draggedId);
  const to = group.findIndex((p) => p.id === targetId);
  if (from === -1 || to === -1) return [];

  const next = [...group];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);

  const changes: Array<{ id: number; sortOrder: number }> = [];
  next.forEach((p, i) => {
    if (p.sortOrder !== i) changes.push({ id: p.id, sortOrder: i });
  });
  return changes;
}
