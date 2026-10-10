// Массовое удаление сущностей (только администратор).
//
// Операция необратимо скрывает много записей сразу, поэтому требует повторного
// ввода пароля текущего администратора — защита от случайного клика и от чужого
// доступа к открытой админ-сессии. Удаление всегда soft-delete (`deleted_at`),
// как и одиночное удаление в соответствующих разделах.
import { RoleType } from '@arbuz/shared';
import { prisma } from '../../lib/prisma';
import { httpError } from '../../lib/http';
import { parseId } from '../../lib/parse';
import { verifyPassword } from '../auth/auth.service';
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

/** Помечает указанные записи удалёнными (soft-delete) в рамках одной сущности. */
async function softDeleteEntity(entity: BulkEntity, actor: CurrentUser, ids: number[]): Promise<number> {
  const now = new Date();
  switch (entity) {
    case 'reviews': {
      const result = await prisma.application_reviews.updateMany({
        where: { id: { in: ids }, deleted_at: null },
        data: { deleted_at: now },
      });
      return result.count;
    }
    case 'applications': {
      const result = await prisma.applications.updateMany({
        where: { id: { in: ids }, deleted_at: null },
        data: { deleted_at: now },
      });
      return result.count;
    }
    case 'posts': {
      const result = await prisma.posts.updateMany({
        where: { id: { in: ids }, deleted_at: null },
        data: { deleted_at: now },
      });
      return result.count;
    }
    case 'users': {
      // Себя удалять нельзя — исключаем id администратора из выборки.
      const result = await prisma.users.updateMany({
        where: { id: { in: ids.filter((id) => id !== actor.id) }, deleted_at: null },
        data: { deleted_at: now },
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
  const deleted = await softDeleteEntity(rawEntity, actor, ids);
  return { entity: rawEntity, deleted };
}
