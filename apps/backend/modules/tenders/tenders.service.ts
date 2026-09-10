// Бизнес-логика тендеров (конкурсов).
import { prisma } from '../../lib/prisma';
import { httpError } from '../../lib/http';

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

function serialize(tender: { id: number; name: string; description: string | null }) {
  return { id: tender.id, name: tender.name, description: tender.description };
}

export async function listTenders() {
  const tenders = await prisma.tenders.findMany({
    where: { deleted_at: null },
    orderBy: { id: 'asc' },
    select: { id: true, name: true, description: true },
  });
  return tenders.map(serialize);
}

export async function getTenderOrThrow(tenderId: number) {
  const tender = await prisma.tenders.findFirst({
    where: { id: tenderId, deleted_at: null },
    select: { id: true, name: true, description: true },
  });
  if (!tender) throw httpError(404, 'Тендер не найден', 'TENDER_NOT_FOUND');
  return serialize(tender);
}

export async function createTender(input: { name?: unknown; description?: unknown }) {
  const tender = await prisma.tenders.create({
    data: { name: requiredName(input.name), description: optionalText(input.description) },
    select: { id: true, name: true, description: true },
  });
  return serialize(tender);
}

export async function updateTender(tenderId: number, patch: { name?: unknown; description?: unknown }) {
  await getTenderOrThrow(tenderId);
  const data: { name?: string; description?: string | null } = {};
  if (patch.name !== undefined) data.name = requiredName(patch.name);
  if (patch.description !== undefined) data.description = optionalText(patch.description);
  const tender = await prisma.tenders.update({
    where: { id: tenderId },
    data,
    select: { id: true, name: true, description: true },
  });
  return serialize(tender);
}

export async function deleteTender(tenderId: number): Promise<void> {
  await getTenderOrThrow(tenderId);
  await prisma.tenders.update({ where: { id: tenderId }, data: { deleted_at: new Date() } });
}
