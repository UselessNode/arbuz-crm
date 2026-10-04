// Бизнес-логика конкурсов
import { prisma } from '../../lib/prisma';
import { httpError } from '../../lib/http';
import { APPLICATION_STATUS_NAMES } from '../../lib/app-status';

export function parseId(raw: string | undefined): number {
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) {
    throw httpError(400, 'Некорректный идентификатор', 'INVALID_ID');
  }
  return value;
}

function requiredName(value: unknown): string {
  const name = String(value ?? '').trim();
  if (!name) throw httpError(400, 'Название обязательно', 'INVALID_BODY');
  return name.slice(0, 255);
}

function optionalText(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text.length ? text : null;
}

/** Число экспертов на заявку: целое 1..20 (по умолчанию 2). */
function expertsCount(value: unknown, fallback: number): number {
  if (value === undefined || value === null || value === '') return fallback;
  const count = Number(value);
  if (!Number.isInteger(count) || count < 1 || count > 20) {
    throw httpError(400, 'Число экспертов должно быть целым от 1 до 20', 'INVALID_EXPERTS_COUNT');
  }
  return count;
}

interface TenderRow {
  id: number;
  name: string;
  description: string | null;
  experts_count: number;
  created_at: Date;
  updated_at: Date;
  _count?: { evaluation_criteria: number } | null;
}

function serialize(tender: TenderRow) {
  return {
    id: tender.id,
    name: tender.name,
    description: tender.description,
    expertsCount: tender.experts_count,
    criteriaCount: tender._count?.evaluation_criteria ?? 0,
    createdAt: tender.created_at,
    updatedAt: tender.updated_at,
  };
}

const tenderSelect = {
  id: true,
  name: true,
  description: true,
  experts_count: true,
  created_at: true,
  updated_at: true,
} as const;

/** Выборка списка: дополнительно считаем число активных критериев конкурса. */
const tenderListSelect = {
  ...tenderSelect,
  _count: { select: { evaluation_criteria: { where: { deleted_at: null } } } },
} as const;

export async function listTenders() {
  const tenders = await prisma.tenders.findMany({
    where: { deleted_at: null },
    orderBy: { id: 'asc' },
    select: tenderListSelect,
  });
  return tenders.map(serialize);
}

export async function getTenderOrThrow(tenderId: number) {
  const tender = await prisma.tenders.findFirst({
    where: { id: tenderId, deleted_at: null },
    select: tenderSelect,
  });
  if (!tender) throw httpError(404, 'Конкурс не найден', 'TENDER_NOT_FOUND');
  return serialize(tender);
}

export async function createTender(input: { name?: unknown; description?: unknown; experts_count?: unknown }) {
  const tender = await prisma.tenders.create({
    data: {
      name: requiredName(input.name),
      description: optionalText(input.description),
      experts_count: expertsCount(input.experts_count, 2),
    },
    select: tenderSelect,
  });
  return serialize(tender);
}

export async function updateTender(
  tenderId: number,
  patch: { name?: unknown; description?: unknown; experts_count?: unknown },
) {
  const existing = await getTenderOrThrow(tenderId);
  const data: { name?: string; description?: string | null; experts_count?: number } = {};
  if (patch.name !== undefined) data.name = requiredName(patch.name);
  if (patch.description !== undefined) data.description = optionalText(patch.description);
  if (patch.experts_count !== undefined) data.experts_count = expertsCount(patch.experts_count, existing.expertsCount);
  const tender = await prisma.tenders.update({ where: { id: tenderId }, data, select: tenderSelect });
  return serialize(tender);
}

export async function deleteTender(tenderId: number): Promise<void> {
  await getTenderOrThrow(tenderId);
  await prisma.tenders.update({ where: { id: tenderId }, data: { deleted_at: new Date() } });
}

/** Сколько заявок и экспертиз затронет сброс по конкурсу (для «опасной зоны»). */
export async function countTenderImpact(tenderId: number): Promise<{ applications: number; reviews: number }> {
  await getTenderOrThrow(tenderId);
  const applications = await prisma.applications.findMany({
    where: { tender_id: tenderId, deleted_at: null },
    select: { id: true },
  });
  const ids = applications.map((application) => application.id);
  const reviews = ids.length
    ? await prisma.application_reviews.count({ where: { application_id: { in: ids }, deleted_at: null } })
    : 0;
  return { applications: ids.length, reviews };
}

async function requireDraftStatusId(): Promise<number> {
  const draft = await prisma.application_statuses.findFirst({
    where: { name: APPLICATION_STATUS_NAMES.draft, deleted_at: null },
    select: { id: true },
  });
  if (!draft) {
    throw httpError(500, `Статус «${APPLICATION_STATUS_NAMES.draft}» не найден — проверьте справочник статусов`, 'STATUS_NOT_FOUND');
  }
  return draft.id;
}

/**
 * «Опасная зона»: сбрасывает заявки конкурса в «черновик» и снимает экспертизы.
 * Вызывается только явно (из настроек конкурса или кнопкой «сброс») — после
 * изменения числа экспертов конкурса.
 */
export async function resetTenderApplications(tenderId: number): Promise<{ applications: number; reviews: number }> {
  await getTenderOrThrow(tenderId);
  const draftStatusId = await requireDraftStatusId();

  const applications = await prisma.applications.findMany({
    where: { tender_id: tenderId, deleted_at: null },
    select: { id: true },
  });
  const ids = applications.map((application) => application.id);
  if (ids.length === 0) return { applications: 0, reviews: 0 };

  const reviews = await prisma.application_reviews.updateMany({
    where: { application_id: { in: ids }, deleted_at: null },
    data: { deleted_at: new Date() },
  });
  await prisma.applications.updateMany({
    where: { id: { in: ids } },
    data: { status_id: draftStatusId, submitted_at: null },
  });

  return { applications: ids.length, reviews: reviews.count };
}
