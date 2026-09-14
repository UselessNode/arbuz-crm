// Статусы публикаций (значения совпадают с PostStatus на бэкенде).
//
// Рантайм-значения зеркалим локально, как и роли (`lib/roles.ts`) и статусы PDF
// (`api/pdf-export.ts`): импорт значений из `@arbuz/shared` тянет в бандл
// сгенерированный Prisma-клиент (CommonJS) и ломает браузер. Тип — только type-only.
import type { PostStatus as PostStatusType } from '@arbuz/shared';

export const PostStatuses = {
  draft: 'draft',
  scheduled: 'scheduled',
  published: 'published',
  archived: 'archived',
} as const satisfies Record<PostStatusType, PostStatusType>;

/** Тип статуса публикации (значения совпадают с `PostStatuses`). */
export type PostStatus = PostStatusType;
