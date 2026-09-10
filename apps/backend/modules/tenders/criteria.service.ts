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
) {
  await getTenderOrThrow(tenderId);
  const criterion = await prisma.evaluation_criteria.create({
    data: {
      tender_id: tenderId,
      name: requiredName(input.name),
      description: optionalText(input.description),
      min_value: numberValue(input.min_value, 0, 'min_value'),
      max_value: numberValue(input.max_value, 10, 'max_value'),
      weight: numberValue(input.weight, 1, 'weight'),
      config: (jsonValue(input.config) as object) ?? undefined,
    },
  });
  return serialize(criterion);
}

export async function updateCriterion(
  tenderId: number,
  criterionId: number,
  patch: { name?: unknown; description?: unknown; min_value?: unknown; max_value?: unknown; weight?: unknown; config?: unknown },
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

  const criterion = await prisma.evaluation_criteria.update({ where: { id: criterionId }, data });
  return serialize(criterion);
}

export async function deleteCriterion(tenderId: number, criterionId: number): Promise<void> {
  await getTenderOrThrow(tenderId);
  const existing = await prisma.evaluation_criteria.findFirst({
    where: { id: criterionId, tender_id: tenderId, deleted_at: null },
    select: { id: true },
  });
  if (!existing) throw httpError(404, 'Критерий не найден', 'CRITERION_NOT_FOUND');
  await prisma.evaluation_criteria.update({ where: { id: criterionId }, data: { deleted_at: new Date() } });
}

export { parseId };
