// Бизнес-логика справочника вердиктов рецензий (review_statuses).
// Вердикт — редактируемый справочник: администратор может добавлять/переименовывать
// варианты и менять их цвет; один из вердиктов помечается «по умолчанию» (для новых рецензий).
import { prisma } from '../../lib/prisma';
import { httpError } from '../../lib/http';
import { optionalBool, optionalOneOf, optionalText, oneOf, requiredText } from '../../lib/parse';

/** Тона бейджей (совпадают с BadgeTone во фронтенде). */
export const REVIEW_STATUS_TONES = ['neutral', 'blue', 'green', 'yellow', 'red', 'purple', 'gray'] as const;
export type ReviewStatusTone = (typeof REVIEW_STATUS_TONES)[number];

export interface ReviewStatusInput {
  name?: unknown;
  description?: unknown;
  tone?: unknown;
  is_default?: unknown;
}

interface ReviewStatusRow {
  id: number;
  name: string;
  description: string | null;
  tone: string;
  is_default: boolean;
}

function serialize(status: ReviewStatusRow) {
  return {
    id: status.id,
    name: status.name,
    description: status.description,
    tone: status.tone,
    isDefault: status.is_default,
  };
}

/** Все активные вердикты: статус по умолчанию — первым, далее по алфавиту. */
export async function listReviewStatuses() {
  const statuses = await prisma.review_statuses.findMany({
    where: { deleted_at: null },
    orderBy: [{ is_default: 'desc' }, { id: 'asc' }],
    select: { id: true, name: true, description: true, tone: true, is_default: true },
  });
  return statuses.map(serialize);
}

export async function getReviewStatusOrThrow(statusId: number) {
  const status = await prisma.review_statuses.findFirst({
    where: { id: statusId, deleted_at: null },
    select: { id: true, name: true, description: true, tone: true, is_default: true },
  });
  if (!status) throw httpError(404, 'Вердикт не найден', 'REVIEW_STATUS_NOT_FOUND');
  return serialize(status);
}

/** Вердикт для новой рецензии (флаг is_default); без него работа невозможна. */
export async function getDefaultReviewStatusId(): Promise<number> {
  const status = await prisma.review_statuses.findFirst({
    where: { deleted_at: null, is_default: true },
    orderBy: { id: 'asc' },
    select: { id: true },
  });
  if (!status) {
    throw httpError(
      500,
      'Не задан вердикт по умолчанию — проверьте справочник вердиктов (см. seed)',
      'REVIEW_STATUS_NOT_CONFIGURED',
    );
  }
  return status.id;
}

export async function createReviewStatus(input: ReviewStatusInput) {
  const isDefault = optionalBool(input.is_default, false) ?? false;
  const created = await prisma.$transaction(async (tx) => {
    if (isDefault) {
      await tx.review_statuses.updateMany({ where: { is_default: true }, data: { is_default: false } });
    }
    return tx.review_statuses.create({
      data: {
        name: requiredText(input.name, 'Название', 100),
        description: optionalText(input.description),
        tone: optionalOneOf(input.tone, REVIEW_STATUS_TONES, 'tone') ?? 'gray',
        is_default: isDefault,
      },
      select: { id: true, name: true, description: true, tone: true, is_default: true },
    });
  });
  return serialize(created);
}

export async function updateReviewStatus(statusId: number, patch: ReviewStatusInput) {
  const current = await getReviewStatusOrThrow(statusId);
  const data: { name?: string; description?: string | null; tone?: string; is_default?: boolean } = {};
  if (patch.name !== undefined) data.name = requiredText(patch.name, 'Название', 100);
  if (patch.description !== undefined) data.description = optionalText(patch.description);
  if (patch.tone !== undefined) data.tone = oneOf(patch.tone, REVIEW_STATUS_TONES, 'tone');

  const nextIsDefault = patch.is_default === undefined ? current.isDefault : Boolean(patch.is_default);
  if (current.isDefault && !nextIsDefault) {
    throw httpError(
      409,
      'Нельзя снять признак «по умолчанию» — сначала назначьте другой вердикт по умолчанию',
      'REVIEW_STATUS_DEFAULT_REQUIRED',
    );
  }
  if (nextIsDefault) data.is_default = true;

  const updated = await prisma.$transaction(async (tx) => {
    if (nextIsDefault) {
      await tx.review_statuses.updateMany({
        where: { is_default: true, id: { not: statusId } },
        data: { is_default: false },
      });
    }
    return tx.review_statuses.update({
      where: { id: statusId },
      data,
      select: { id: true, name: true, description: true, tone: true, is_default: true },
    });
  });
  return serialize(updated);
}

/** Удаление вердикта: запрещено для «по умолчанию» и для используемых в рецензиях. */
export async function deleteReviewStatus(statusId: number): Promise<void> {
  const status = await getReviewStatusOrThrow(statusId);
  if (status.isDefault) {
    throw httpError(409, 'Вердикт по умолчанию удалить нельзя — назначьте другой', 'REVIEW_STATUS_DEFAULT');
  }
  const used = await prisma.application_reviews.count({ where: { status_id: statusId, deleted_at: null } });
  if (used > 0) {
    throw httpError(
      409,
      `Вердикт используется в рецензиях (${used}). Сначала измените их вердикт.`,
      'REVIEW_STATUS_IN_USE',
    );
  }
  await prisma.review_statuses.update({ where: { id: statusId }, data: { deleted_at: new Date() } });
}
