/*
 * Статусы публикаций (лента новостей).
 *
 * В БД не хранятся: вычисляются из полей posts (is_published, scheduled_at,
 * archived_at). Так отложенная публикация «включается» сама по наступлении даты
 * без фонового воркера. Значения общие для backend и frontend.
 */
export const PostStatus = {
  draft: 'draft',
  scheduled: 'scheduled',
  published: 'published',
  archived: 'archived',
} as const;

export type PostStatus = (typeof PostStatus)[keyof typeof PostStatus];

/** Порядок совпадает с жизненным циклом публикации. */
export const POST_STATUSES = [
  PostStatus.draft,
  PostStatus.scheduled,
  PostStatus.published,
  PostStatus.archived,
] as const;

/** Проверка значения из query/API: сужает строку до PostStatus. */
export function isPostStatus(value: string): value is PostStatus {
  return (POST_STATUSES as readonly string[]).includes(value);
}
