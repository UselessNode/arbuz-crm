// Клиентская сортировка строк по активной колонке DataView (для списков, загруженных целиком).
import type { DataViewSort } from '../components/ui';

/**
 * Сортирует строки по полю `sort.field` через `accessor`.
 * Пустые значения уходят в конец; числа сравниваются численно, строки — по правилам «ru».
 */
export function sortRows<T>(
  rows: readonly T[],
  sort: DataViewSort | null,
  accessor: (row: T, field: string) => string | number | null | undefined,
): T[] {
  if (!sort) return rows as T[];
  const factor = sort.direction === 'asc' ? 1 : -1;
  return [...rows].sort((left, right) => {
    const a = accessor(left, sort.field);
    const b = accessor(right, sort.field);
    if (a == null && b == null) return 0;
    if (a == null) return 1;
    if (b == null) return -1;
    if (typeof a === 'number' && typeof b === 'number') return (a - b) * factor;
    return String(a).localeCompare(String(b), 'ru', { numeric: true, sensitivity: 'base' }) * factor;
  });
}
