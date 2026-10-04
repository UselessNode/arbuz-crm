// Чистая (де)сериализация DataView-запроса в URLSearchParams и построение активных чипов.
//
// Формат параметров:
//   q                 — текстовый поиск;
//   page, pageSize    — пагинация (page=1 и дефолтный размер опускаются);
//   sort, order       — сортировка;
//   <field>           — мультизначение через запятую (checkbox-group / multi-select);
//   <field>_from/_to  — диапазон дат;
//   <field>_min/_max  — числовой диапазон.
import type {
  ActiveFilter,
  DataViewQuery,
  DataViewSort,
  DateRangeValue,
  FilterSpec,
  FilterValue,
  RangeValue,
} from './types';

export const DEFAULT_PAGE_SIZE = 20;

export interface QueryDefaults {
  pageSize?: number;
}

function clampInt(raw: string | null, min: number, max: number, fallback: number): number {
  if (raw === null || raw === '') return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value)) return fallback;
  return Math.min(Math.max(Math.trunc(value), min), max);
}

function parseNumber(raw: string | null): number | null {
  if (raw === null || raw === '') return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

/** Читает запрос из URL-параметров. */
export function readQuery(params: URLSearchParams, specs: readonly FilterSpec[], defaults: QueryDefaults = {}): DataViewQuery {
  const pageSize = clampInt(params.get('pageSize'), 1, 500, defaults.pageSize ?? DEFAULT_PAGE_SIZE);
  const page = clampInt(params.get('page'), 1, 1_000_000, 1);
  const search = (params.get('q') ?? '').trim();
  const sortField = params.get('sort');
  const sort: DataViewSort | null = sortField
    ? { field: sortField, direction: params.get('order') === 'desc' ? 'desc' : 'asc' }
    : null;

  const filters: Record<string, FilterValue> = {};
  for (const spec of specs) {
    const value = readFilter(params, spec);
    if (value !== null) filters[spec.field] = value;
  }

  return { search, page, pageSize, sort, filters };
}

function readFilter(params: URLSearchParams, spec: FilterSpec): FilterValue | null {
  if (spec.kind === 'checkbox-group' || spec.kind === 'multi-select') {
    const raw = params.get(spec.field);
    if (!raw) return null;
    const values = raw
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);
    return values.length ? values : null;
  }
  if (spec.kind === 'date-range') {
    const from = params.get(`${spec.field}_from`) ?? '';
    const to = params.get(`${spec.field}_to`) ?? '';
    return from || to ? { from, to } : null;
  }
  const min = parseNumber(params.get(`${spec.field}_min`));
  const max = parseNumber(params.get(`${spec.field}_max`));
  return min !== null || max !== null ? { min, max } : null;
}

/** Записывает запрос в URL-параметры (дефолты опускаются). */
export function writeQuery(query: DataViewQuery, specs: readonly FilterSpec[], defaults: QueryDefaults = {}): URLSearchParams {
  const params = new URLSearchParams();
  if (query.search) params.set('q', query.search);
  if (query.page > 1) params.set('page', String(query.page));
  if (query.pageSize !== (defaults.pageSize ?? DEFAULT_PAGE_SIZE)) params.set('pageSize', String(query.pageSize));
  if (query.sort) {
    params.set('sort', query.sort.field);
    params.set('order', query.sort.direction);
  }
  for (const spec of specs) {
    const value = query.filters[spec.field];
    if (value === undefined) continue;
    writeFilter(params, spec, value);
  }
  return params;
}

function writeFilter(params: URLSearchParams, spec: FilterSpec, value: FilterValue): void {
  if (spec.kind === 'checkbox-group' || spec.kind === 'multi-select') {
    const values = value as string[];
    if (values.length) params.set(spec.field, values.join(','));
    return;
  }
  if (spec.kind === 'date-range') {
    const range = value as DateRangeValue;
    if (range.from) params.set(`${spec.field}_from`, range.from);
    if (range.to) params.set(`${spec.field}_to`, range.to);
    return;
  }
  const range = value as RangeValue;
  if (range.min !== null && range.min !== undefined) params.set(`${spec.field}_min`, String(range.min));
  if (range.max !== null && range.max !== undefined) params.set(`${spec.field}_max`, String(range.max));
}

function isoToRu(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return match ? `${match[3]}.${match[2]}.${match[1]}` : iso;
}

/** Человекочитаемая подпись опции: сначала из переданных лейблов, затем из статичных options. */
function optionLabel(spec: FilterSpec, value: string, labels: Record<string, Record<string, string>>): string {
  const external = labels[spec.field]?.[value];
  if (external) return external;
  if (spec.kind === 'checkbox-group') return spec.options.find((option) => option.value === value)?.label ?? value;
  return value;
}

/**
 * Собирает список активных фильтров для чипов.
 * `labels` — кэш подписей асинхронных фильтров (field → value → label).
 */
export function activeFilters(
  query: DataViewQuery,
  specs: readonly FilterSpec[],
  labels: Record<string, Record<string, string>> = {},
): ActiveFilter[] {
  const result: ActiveFilter[] = [];
  if (query.search) {
    result.push({ key: 'search', field: 'search', label: 'Поиск', text: `«${query.search}»` });
  }
  for (const spec of specs) {
    const value = query.filters[spec.field];
    if (value === undefined) continue;
    if (spec.kind === 'checkbox-group' || spec.kind === 'multi-select') {
      for (const item of value as string[]) {
        result.push({
          key: `${spec.field}:${item}`,
          field: spec.field,
          label: spec.label,
          text: optionLabel(spec, item, labels),
          value: item,
        });
      }
      continue;
    }
    if (spec.kind === 'date-range') {
      const range = value as DateRangeValue;
      const parts = [range.from ? `с ${isoToRu(range.from)}` : '', range.to ? `по ${isoToRu(range.to)}` : ''].filter(Boolean);
      result.push({ key: spec.field, field: spec.field, label: spec.label, text: parts.join(' ') });
      continue;
    }
    const range = value as RangeValue;
    const left = range.min ?? '…';
    const right = range.max ?? '…';
    const unit = spec.unit ? ` ${spec.unit}` : '';
    result.push({ key: spec.field, field: spec.field, label: spec.label, text: `${left} – ${right}${unit}` });
  }
  return result;
}

/** Убирает значение из фильтра; возвращает новую карту фильтров. */
export function removeFilterValue(
  filters: Record<string, FilterValue>,
  field: string,
  value?: string,
): Record<string, FilterValue> {
  const next = { ...filters };
  const current = next[field];
  if (current === undefined) return next;
  if (Array.isArray(current)) {
    if (value === undefined) {
      delete next[field];
      return next;
    }
    const filtered = current.filter((item) => item !== value);
    if (filtered.length) next[field] = filtered;
    else delete next[field];
    return next;
  }
  delete next[field];
  return next;
}

/** Есть ли активные фильтры (не считая поиск). */
export function hasActiveFilters(query: DataViewQuery): boolean {
  if (query.search) return true;
  return Object.values(query.filters).some((value) => !isFilterValueEmpty(value));
}

export function isFilterValueEmpty(value: FilterValue): boolean {
  if (Array.isArray(value)) return value.length === 0;
  if ('from' in value) return !value.from && !value.to;
  return (value.min === null || value.min === undefined) && (value.max === null || value.max === undefined);
}

/** Следующий шаг цикла сортировки: asc → desc → без сортировки. */
export function cycleSort(current: DataViewSort | null, field: string): DataViewSort | null {
  if (!current || current.field !== field) return { field, direction: 'asc' };
  if (current.direction === 'asc') return { field, direction: 'desc' };
  return null;
}
