// Бизнес-логика направлений заявок.
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

function optionalId(value: unknown): number | null {
  if (value === undefined || value === null || value === '') return null;
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) throw httpError(400, 'Некорректный идентификатор', 'INVALID_ID');
  return id;
}

async function ensureTenderExists(tenderId: number | null): Promise<void> {
  if (tenderId === null) return;
  const tender = await prisma.tenders.findFirst({ where: { id: tenderId, deleted_at: null }, select: { id: true } });
  if (!tender) throw httpError(404, 'Конкурс не найден', 'TENDER_NOT_FOUND');
}

const directionSelect = {
  id: true,
  name: true,
  description: true,
  tender_id: true,
  created_at: true,
  updated_at: true,
} as const;

function serialize(direction: {
  id: number;
  name: string;
  description: string | null;
  tender_id: number | null;
  created_at: Date;
  updated_at: Date;
}) {
  return {
    id: direction.id,
    name: direction.name,
    description: direction.description,
    tenderId: direction.tender_id,
    createdAt: direction.created_at,
    updatedAt: direction.updated_at,
  };
}

export async function listDirections(tenderId?: number) {
  const directions = await prisma.directions.findMany({
    where: { deleted_at: null, ...(tenderId !== undefined ? { tender_id: tenderId } : {}) },
    orderBy: { id: 'asc' },
    select: directionSelect,
  });
  return directions.map(serialize);
}

export async function getDirectionOrThrow(directionId: number) {
  const direction = await prisma.directions.findFirst({
    where: { id: directionId, deleted_at: null },
    select: directionSelect,
  });
  if (!direction) throw httpError(404, 'Направление не найдено', 'DIRECTION_NOT_FOUND');
  return serialize(direction);
}

export async function createDirection(input: { name?: unknown; description?: unknown; tender_id?: unknown }) {
  const tenderId = optionalId(input.tender_id);
  await ensureTenderExists(tenderId);
  const direction = await prisma.directions.create({
    data: { name: requiredName(input.name), description: optionalText(input.description), tender_id: tenderId },
    select: directionSelect,
  });
  return serialize(direction);
}

export async function updateDirection(directionId: number, patch: { name?: unknown; description?: unknown; tender_id?: unknown }) {
  await getDirectionOrThrow(directionId);
  const data: { name?: string; description?: string | null; tender_id?: number | null } = {};
  if (patch.name !== undefined) data.name = requiredName(patch.name);
  if (patch.description !== undefined) data.description = optionalText(patch.description);
  if (patch.tender_id !== undefined) {
    const tenderId = optionalId(patch.tender_id);
    await ensureTenderExists(tenderId);
    data.tender_id = tenderId;
  }
  const direction = await prisma.directions.update({
    where: { id: directionId },
    data,
    select: directionSelect,
  });
  return serialize(direction);
}

export async function deleteDirection(directionId: number): Promise<void> {
  await getDirectionOrThrow(directionId);
  await prisma.directions.update({ where: { id: directionId }, data: { deleted_at: new Date() } });
}
