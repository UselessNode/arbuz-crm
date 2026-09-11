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

/** Булев фильтр из query (`true`/`false`); иное значение → undefined. */
export function parseOptionalBoolean(raw: unknown): boolean | undefined {
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  return undefined;
}
