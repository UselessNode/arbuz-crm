// Бизнес-логика справочника регионов.
// Отдельная таблица (а не enum) — чтобы регионы можно было добавлять/переименовывать
// без изменения кода (юридическая устойчивость при переименовании субъектов РФ).
import { prisma } from '../../lib/prisma';
import { httpError } from '../../lib/http';

export interface Region {
  id: number;
  name: string;
  isDefault: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

const regionSelect = {
  id: true,
  name: true,
  is_default: true,
  sort_order: true,
  created_at: true,
  updated_at: true,
} as const;

function serialize(region: {
  id: number;
  name: string;
  is_default: boolean;
  sort_order: number;
  created_at: Date;
  updated_at: Date;
}): Region {
  return {
    id: region.id,
    name: region.name,
    isDefault: region.is_default,
    sortOrder: region.sort_order,
    createdAt: region.created_at,
    updatedAt: region.updated_at,
  };
}

function requiredName(value: unknown): string {
  const name = String(value ?? '').trim();
  if (!name) throw httpError(400, 'Название региона обязательно', 'INVALID_BODY');
  return name.slice(0, 200);
}

function optionalBoolean(value: unknown): boolean | undefined {
  if (value === undefined || value === null) return undefined;
  return Boolean(value);
}

function parseSortOrder(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) throw httpError(400, 'Некорректный порядок', 'INVALID_BODY');
  return parsed;
}

/** Активные регионы (не удалённые), по порядку, затем по названию. */
export async function listRegions(): Promise<Region[]> {
  const regions = await prisma.regions.findMany({
    where: { deleted_at: null },
    orderBy: [{ sort_order: 'asc' }, { name: 'asc' }],
    select: regionSelect,
  });
  return regions.map(serialize);
}

export async function getRegionOrThrow(regionId: number): Promise<Region> {
  const region = await prisma.regions.findFirst({ where: { id: regionId, deleted_at: null }, select: regionSelect });
  if (!region) throw httpError(404, 'Регион не найден', 'REGION_NOT_FOUND');
  return serialize(region);
}

/** Регион по умолчанию (для подстановки в формах); null, если не задан. */
export async function getDefaultRegion(): Promise<Region | null> {
  const region = await prisma.regions.findFirst({
    where: { is_default: true, deleted_at: null },
    select: regionSelect,
  });
  return region ? serialize(region) : null;
}

/** Снимает флаг «по умолчанию» со всех регионов (кроме указанного). */
async function clearOtherDefaults(exceptId: number): Promise<void> {
  await prisma.regions.updateMany({
    where: { is_default: true, id: { not: exceptId } },
    data: { is_default: false },
  });
}

export async function createRegion(input: { name?: unknown; is_default?: unknown; sort_order?: unknown }): Promise<Region> {
  const name = requiredName(input.name);
  const existing = await prisma.regions.findUnique({ where: { name } });
  if (existing) throw httpError(409, 'Регион с таким названием уже существует', 'REGION_TAKEN');

  const region = await prisma.regions.create({
    data: {
      name,
      is_default: optionalBoolean(input.is_default) ?? false,
      sort_order: parseSortOrder(input.sort_order) ?? 0,
    },
    select: regionSelect,
  });
  if (region.is_default) await clearOtherDefaults(region.id);
  return serialize(region);
}

export async function updateRegion(
  regionId: number,
  patch: { name?: unknown; is_default?: unknown; sort_order?: unknown },
): Promise<Region> {
  await getRegionOrThrow(regionId);
  const data: { name?: string; is_default?: boolean; sort_order?: number } = {};

  if (patch.name !== undefined) {
    const name = requiredName(patch.name);
    const taken = await prisma.regions.findUnique({ where: { name } });
    if (taken && taken.id !== regionId) throw httpError(409, 'Регион с таким названием уже существует', 'REGION_TAKEN');
    data.name = name;
  }
  const isDefault = optionalBoolean(patch.is_default);
  if (isDefault !== undefined) data.is_default = isDefault;
  const sortOrder = parseSortOrder(patch.sort_order);
  if (sortOrder !== undefined) data.sort_order = sortOrder;

  const region = await prisma.regions.update({ where: { id: regionId }, data, select: regionSelect });
  if (region.is_default) await clearOtherDefaults(region.id);
  return serialize(region);
}

export async function deleteRegion(regionId: number): Promise<void> {
  await getRegionOrThrow(regionId);
  await prisma.regions.update({ where: { id: regionId }, data: { deleted_at: new Date() } });
}
