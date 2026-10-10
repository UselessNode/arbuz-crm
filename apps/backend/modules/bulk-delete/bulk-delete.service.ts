// Массовое удаление сущностей (только администратор).
//
// Операция необратимо удаляет много записей сразу, поэтому требует повторного
// ввода пароля текущего администратора — защита от случайного клика и от чужого
// доступа к открытой админ-сессии. Для экспертиз/заявок/публикаций удаление
// физическое (вместе с файлами), как и одиночное удаление в разделах;
// пользователи пока удаляются мягко.
import { RoleType } from '@arbuz/shared';
import { prisma } from '../../lib/prisma';
import { httpError } from '../../lib/http';
import { parseId } from '../../lib/parse';
import { verifyPassword } from '../auth/auth.service';
import { hardDeleteApplication } from '../applications/applications.service';
import { hardDeletePost } from '../posts/posts.service';
import type { CurrentUser } from '../files/files.service';

/** Сущности, поддерживающие массовое удаление. */
export const BULK_ENTITIES = ['reviews', 'applications', 'users', 'posts'] as const;
export type BulkEntity = (typeof BULK_ENTITIES)[number];

/** Максимум id за один запрос — защита от тяжёлых операций. */
const MAX_IDS = 500;

export interface BulkDeleteResult {
  entity: BulkEntity;
  /** Сколько записей реально помечено удалёнными. */
  deleted: number;
}

function isBulkEntity(value: unknown): value is BulkEntity {
  return typeof value === 'string' && (BULK_ENTITIES as readonly string[]).includes(value);
}

/** Разбирает и валидирует id из тела запроса (массив положительных целых, без дублей). */
function parseIds(raw: unknown): number[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    throw httpError(400, 'Не выбрано ни одной записи', 'EMPTY_SELECTION');
  }
  if (raw.length > MAX_IDS) {
    throw httpError(400, `Слишком много записей (максимум ${MAX_IDS})`, 'SELECTION_TOO_LARGE');
  }
  return [...new Set(raw.map((value) => parseId(value, 'Некорректный идентификатор')))];
}

/** Проверяет пароль текущего администратора (повторная авторизация перед удалением). */
async function assertPassword(actor: CurrentUser, rawPassword: unknown): Promise<void> {
  const password = typeof rawPassword === 'string' ? rawPassword : '';
  if (!password) throw httpError(400, 'Введите пароль для подтверждения', 'PASSWORD_REQUIRED');
  const user = await prisma.users.findFirst({
    where: { id: actor.id, deleted_at: null },
    select: { password_hash: true },
  });
  if (!user) throw httpError(401, 'Пользователь не найден', 'UNAUTHORIZED');
  const valid = await verifyPassword(password, user.password_hash);
  if (!valid) throw httpError(403, 'Неверный пароль', 'INVALID_PASSWORD');
}

/** Физически удаляет указанные записи одной сущности (каскад и файлы — в сервисах сущностей). */
async function purgeEntity(entity: BulkEntity, actor: CurrentUser, ids: number[]): Promise<number> {
  switch (entity) {
    case 'reviews': {
      const result = await prisma.application_reviews.deleteMany({ where: { id: { in: ids } } });
      return result.count;
    }
    case 'applications': {
      const existing = await prisma.applications.findMany({ where: { id: { in: ids } }, select: { id: true } });
      for (const application of existing) await hardDeleteApplication(application.id);
      return existing.length;
    }
    case 'posts': {
      const existing = await prisma.posts.findMany({ where: { id: { in: ids } }, select: { id: true } });
      for (const post of existing) await hardDeletePost(post.id);
      return existing.length;
    }
    case 'users': {
      // Пользователи пока удаляются мягко — жёсткое удаление с каскадом вынесено в отдельную задачу.
      const result = await prisma.users.updateMany({
        where: { id: { in: ids.filter((id) => id !== actor.id) }, deleted_at: null },
        data: { deleted_at: new Date() },
      });
      return result.count;
    }
  }
}

/** Массовое удаление: проверяет права и пароль, выполняет soft-delete. */
export async function bulkDelete(
  actor: CurrentUser,
  rawEntity: unknown,
  rawIds: unknown,
  rawPassword: unknown,
): Promise<BulkDeleteResult> {
  if (actor.role !== RoleType.admin) {
    throw httpError(403, 'Действие доступно только администратору', 'FORBIDDEN');
  }
  if (!isBulkEntity(rawEntity)) {
    throw httpError(400, 'Неизвестный тип сущности', 'UNKNOWN_ENTITY');
  }
  const ids = parseIds(rawIds);
  await assertPassword(actor, rawPassword);
  const deleted = await purgeEntity(rawEntity, actor, ids);
  return { entity: rawEntity, deleted };
}
