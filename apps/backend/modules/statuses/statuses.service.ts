// Бизнес-логика статусов заявок.
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
  return name.slice(0, 50);
}

function optionalText(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text.length ? text : null;
}

function optionalBool(value: unknown): boolean | null {
  if (value === undefined || value === null) return null;
  return Boolean(value);
}

function serialize(status: {
  id: number;
  name: string;
  is_editable: boolean | null;
  is_deletable: boolean | null;
  description: string | null;
}) {
  return {
    id: status.id,
    name: status.name,
    isEditable: status.is_editable,
    isDeletable: status.is_deletable,
    description: status.description,
  };
}

export async function listStatuses() {
  const statuses = await prisma.application_statuses.findMany({
    where: { deleted_at: null },
    orderBy: { id: 'asc' },
  });
  return statuses.map(serialize);
}

export async function getStatusOrThrow(statusId: number) {
  const status = await prisma.application_statuses.findFirst({
    where: { id: statusId, deleted_at: null },
  });
  if (!status) throw httpError(404, 'Статус не найден', 'STATUS_NOT_FOUND');
  return serialize(status);
}

export async function createStatus(input: { name?: unknown; description?: unknown; is_editable?: unknown; is_deletable?: unknown }) {
  const status = await prisma.application_statuses.create({
    data: {
      name: requiredName(input.name),
      description: optionalText(input.description),
      is_editable: optionalBool(input.is_editable) ?? true,
      is_deletable: optionalBool(input.is_deletable) ?? true,
    },
  });
  return serialize(status);
}

export async function updateStatus(
  statusId: number,
  patch: { name?: unknown; description?: unknown; is_editable?: unknown; is_deletable?: unknown },
) {
  await getStatusOrThrow(statusId);
  const data: { name?: string; description?: string | null; is_editable?: boolean | null; is_deletable?: boolean | null } = {};
  if (patch.name !== undefined) data.name = requiredName(patch.name);
  if (patch.description !== undefined) data.description = optionalText(patch.description);
  if (patch.is_editable !== undefined) data.is_editable = optionalBool(patch.is_editable);
  if (patch.is_deletable !== undefined) data.is_deletable = optionalBool(patch.is_deletable);

  const status = await prisma.application_statuses.update({ where: { id: statusId }, data });
  return serialize(status);
}

export async function deleteStatus(statusId: number): Promise<void> {
  await getStatusOrThrow(statusId);
  await prisma.application_statuses.update({ where: { id: statusId }, data: { deleted_at: new Date() } });
}
