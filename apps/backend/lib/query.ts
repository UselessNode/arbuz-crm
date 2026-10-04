// Разбор query-параметров списочных эндпоинтов: пагинация, поиск, фильтры.
import type { Request } from 'express';

export interface PaginationQuery {
  limit: number;
  offset: number;
}

/** limit (1..100, по умолчанию 20) и offset (>= 0). */
export function parseLimitOffset(query: Request['query']): PaginationQuery {
  const limit = Number(query.limit ?? 20);
  const offset = Number(query.offset ?? 0);
  return {
    limit: Number.isFinite(limit) ? Math.min(Math.max(Math.trunc(limit), 1), 100) : 20,
    offset: Number.isFinite(offset) ? Math.max(Math.trunc(offset), 0) : 0,
  };
}

/** Поисковая строка `q` (пустая → undefined). */
export function parseSearch(query: Request['query'], maxLength = 100): string | undefined {
  const raw = query.q;
  if (raw === undefined || raw === null) return undefined;
  const text = String(raw).trim();
  return text ? text.slice(0, maxLength) : undefined;
}

/** Идентификатор из query (пустое/некорректное значение → undefined). */
export function parseOptionalId(raw: unknown): number | undefined {
  if (raw === undefined || raw === null || raw === '') return undefined;
  const value = Number(raw);
  return Number.isInteger(value) && value > 0 ? value : undefined;
}

/** Пагинация, включаемая только при явно заданном `limit` (иначе без ограничения). */
export function parseOptionalLimitOffset(
  query: Request['query'],
  maxLimit = 500,
): { limit: number | null; offset: number } {
  const offsetRaw = Number(query.offset ?? 0);
  const offset = Number.isFinite(offsetRaw) ? Math.max(Math.trunc(offsetRaw), 0) : 0;
  const rawLimit = query.limit;
  if (rawLimit === undefined || rawLimit === null || rawLimit === '') return { limit: null, offset };
  const limit = Number(rawLimit);
  return { limit: Number.isFinite(limit) ? Math.min(Math.max(Math.trunc(limit), 1), maxLimit) : null, offset };
}

/**
 * Массив положительных id: принимает CSV (`ids=1,2,3`) и повторяющийся параметр.
 * Пустой/некорректный ввод → undefined (фильтр не применяется).
 */
export function parseIdArray(raw: unknown): number[] | undefined {
  if (raw === undefined || raw === null || raw === '') return undefined;
  const values = flattenQueryValues(raw)
    .map((entry) => Number(entry.trim()))
    .filter((value) => Number.isInteger(value) && value > 0);
  return values.length ? [...new Set(values)] : undefined;
}

/** Массив значений из разрешённого набора (CSV / повторяющийся параметр). */
export function parseEnumArray<T extends string>(raw: unknown, allowed: readonly T[]): T[] | undefined {
  if (raw === undefined || raw === null || raw === '') return undefined;
  const values = flattenQueryValues(raw)
    .map((entry) => entry.trim())
    .filter((entry): entry is T => (allowed as readonly string[]).includes(entry));
  return values.length ? [...new Set(values)] : undefined;
}

/** Булев параметр: true/1/false/0 (иначе undefined). */
export function parseBoolParam(raw: unknown): boolean | undefined {
  if (raw === undefined || raw === null || raw === '') return undefined;
  const value = String(raw).toLowerCase();
  if (value === 'true' || value === '1') return true;
  if (value === 'false' || value === '0') return false;
  return undefined;
}

/** Структурно совместимо с `Prisma.DateTimeFilter`. */
export interface DateRangeFilter {
  gte?: Date;
  lte?: Date;
}

/** Диапазон дат по паре `<field>_from` / `<field>_to` (конец дня включается). */
export function parseDateRange(query: Request['query'], field: string): DateRangeFilter | undefined {
  const from = parseDateBound(query[`${field}_from`], false);
  const to = parseDateBound(query[`${field}_to`], true);
  if (!from && !to) return undefined;
  return { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) };
}

/** Граница диапазона: `yyyy-mm-dd` или ISO; `end` — конец дня. */
export function parseDateBound(raw: unknown, end = false): Date | undefined {
  if (raw === undefined || raw === null || raw === '') return undefined;
  const text = String(raw);
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(text) ? `${text}T${end ? '23:59:59.999' : '00:00:00.000'}` : text;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

/** Диапазон чисел по паре `<field>_min` / `<field>_max`. */
export interface NumberRangeFilter {
  min?: number;
  max?: number;
}

export function parseNumberRange(query: Request['query'], field: string): NumberRangeFilter | undefined {
  const min = parseNumber(query[`${field}_min`]);
  const max = parseNumber(query[`${field}_max`]);
  if (min === undefined && max === undefined) return undefined;
  return { ...(min !== undefined ? { min } : {}), ...(max !== undefined ? { max } : {}) };
}

/** Необязательное конечное число из query. */
export function parseNumber(raw: unknown): number | undefined {
  if (raw === undefined || raw === null || raw === '') return undefined;
  const value = Number(raw);
  return Number.isFinite(value) ? value : undefined;
}

export interface SortSpec {
  field: string;
  direction: 'asc' | 'desc';
}

/**
 * Разбор сортировки `?sort=<field>&order=asc|desc`.
 * Возвращает null, если `sort` не задан или не входит в белый список
 * (тогда сервис применяет свой естественный порядок).
 */
export function parseSort(query: Request['query'], allowed: readonly string[]): SortSpec | null {
  const raw = query.sort;
  if (typeof raw !== 'string' || !allowed.includes(raw)) return null;
  const direction = query.order === 'desc' ? 'desc' : 'asc';
  return { field: raw, direction };
}

function flattenQueryValues(raw: unknown): string[] {
  return (Array.isArray(raw) ? raw : [raw]).flatMap((entry) => String(entry).split(','));
}
