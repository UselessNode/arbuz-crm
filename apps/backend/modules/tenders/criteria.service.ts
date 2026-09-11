// Бизнес-логика критериев оценивания тендера.
import { prisma } from '../../lib/prisma';
import { httpError } from '../../lib/http';
import { getTenderOrThrow, parseId } from './tenders.service';

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

function numberValue(value: unknown, fallback: number, field: string): number {
  if (value === undefined || value === null || value === '') return fallback;
  const n = Number(value);
  if (!Number.isFinite(n)) throw httpError(400, `Некорректное значение поля ${field}`, 'INVALID_NUMBER');
  return n;
}

function jsonValue(value: unknown): unknown {
  if (value === undefined || value === null) return undefined;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      throw httpError(400, 'Некорректный JSON в поле config', 'INVALID_JSON');
    }
  }
  return value;
}

function serialize(criterion: {
  id: number;
  tender_id: number;
  name: string;
  description: string | null;
  min_value: number;
  max_value: number;
  weight: number;
  config: unknown;
}) {
  return {
    id: criterion.id,
    tenderId: criterion.tender_id,
    name: criterion.name,
    description: criterion.description,
    minValue: criterion.min_value,
    maxValue: criterion.max_value,
    weight: criterion.weight,
    config: criterion.config,
  };
}

function assertRange(minValue: number, maxValue: number, weight: number): void {
  if (minValue > maxValue) {
    throw httpError(400, 'min_value не может быть больше max_value', 'INVALID_RANGE');
  }
  if (weight <= 0) {
    throw httpError(400, 'Вес критерия должен быть больше нуля', 'INVALID_WEIGHT');
  }
}

type CriterionHistoryAction = 'created' | 'updated' | 'deleted' | 'reset';

interface CriterionSnapshot {
  id: number;
  name: string;
  description: string | null;
  min_value: number;
  max_value: number;
  weight: number;
  config: unknown;
}

/** Пишет снимок критерия в историю изменений по конкурсу. */
async function recordHistory(
  tenderId: number,
  action: CriterionHistoryAction,
  criterion: CriterionSnapshot,
  actorId?: number,
): Promise<void> {
  await prisma.evaluation_criteria_history.create({
    data: {
      tender_id: tenderId,
      criterion_id: criterion.id,
      action,
      name: criterion.name,
      description: criterion.description,
      min_value: criterion.min_value,
      max_value: criterion.max_value,
      weight: criterion.weight,
      config: (criterion.config as object) ?? undefined,
      changed_by: actorId ?? null,
    },
  });
}

/** История изменений критериев конкурса (от новых к старым). */
export async function listCriteriaHistory(tenderId: number) {
  await getTenderOrThrow(tenderId);
  const rows = await prisma.evaluation_criteria_history.findMany({
    where: { tender_id: tenderId },
    orderBy: { id: 'desc' },
    take: 100,
    select: {
      id: true,
      criterion_id: true,
      action: true,
      name: true,
      min_value: true,
      max_value: true,
      weight: true,
      changed_by: true,
      changed_at: true,
    },
  });
  return rows.map((row) => ({
    id: row.id,
    criterionId: row.criterion_id,
    action: row.action,
    name: row.name,
    minValue: row.min_value,
    maxValue: row.max_value,
    weight: row.weight,
    changedBy: row.changed_by,
    changedAt: row.changed_at,
  }));
}

export async function listCriteria(tenderId: number) {
  await getTenderOrThrow(tenderId);
  const criteria = await prisma.evaluation_criteria.findMany({
    where: { tender_id: tenderId, deleted_at: null },
    orderBy: { id: 'asc' },
  });
  return criteria.map(serialize);
}

export async function createCriterion(
  tenderId: number,
  input: { name?: unknown; description?: unknown; min_value?: unknown; max_value?: unknown; weight?: unknown; config?: unknown },
  actorId?: number,
) {
  await getTenderOrThrow(tenderId);
  const minValue = numberValue(input.min_value, 0, 'min_value');
  const maxValue = numberValue(input.max_value, 10, 'max_value');
  const weight = numberValue(input.weight, 1, 'weight');
  assertRange(minValue, maxValue, weight);

  const criterion = await prisma.evaluation_criteria.create({
    data: {
      tender_id: tenderId,
      name: requiredName(input.name),
      description: optionalText(input.description),
      min_value: minValue,
      max_value: maxValue,
      weight,
      config: (jsonValue(input.config) as object) ?? undefined,
    },
  });
  await recordHistory(tenderId, 'created', criterion, actorId);
  return serialize(criterion);
}

export async function updateCriterion(
  tenderId: number,
  criterionId: number,
  patch: { name?: unknown; description?: unknown; min_value?: unknown; max_value?: unknown; weight?: unknown; config?: unknown },
  actorId?: number,
) {
  await getTenderOrThrow(tenderId);
  const existing = await prisma.evaluation_criteria.findFirst({
    where: { id: criterionId, tender_id: tenderId, deleted_at: null },
  });
  if (!existing) throw httpError(404, 'Критерий не найден', 'CRITERION_NOT_FOUND');

  const data: Record<string, unknown> = {};
  if (patch.name !== undefined) data.name = requiredName(patch.name);
  if (patch.description !== undefined) data.description = optionalText(patch.description);
  if (patch.min_value !== undefined) data.min_value = numberValue(patch.min_value, existing.min_value, 'min_value');
  if (patch.max_value !== undefined) data.max_value = numberValue(patch.max_value, existing.max_value, 'max_value');
  if (patch.weight !== undefined) data.weight = numberValue(patch.weight, existing.weight, 'weight');
  if (patch.config !== undefined) data.config = jsonValue(patch.config);

  const minValue = (data.min_value as number | undefined) ?? existing.min_value;
  const maxValue = (data.max_value as number | undefined) ?? existing.max_value;
  const weight = (data.weight as number | undefined) ?? existing.weight;
  assertRange(minValue, maxValue, weight);

  const criterion = await prisma.evaluation_criteria.update({ where: { id: criterionId }, data });
  await recordHistory(tenderId, 'updated', criterion, actorId);
  return serialize(criterion);
}

export async function deleteCriterion(tenderId: number, criterionId: number, actorId?: number): Promise<void> {
  await getTenderOrThrow(tenderId);
  const existing = await prisma.evaluation_criteria.findFirst({
    where: { id: criterionId, tender_id: tenderId, deleted_at: null },
  });
  if (!existing) throw httpError(404, 'Критерий не найден', 'CRITERION_NOT_FOUND');
  await prisma.evaluation_criteria.update({ where: { id: criterionId }, data: { deleted_at: new Date() } });
  await recordHistory(tenderId, 'deleted', existing, actorId);
}

export { parseId };
