// Таблица: колонки с произвольным рендером ячеек (можно вкладывать бейджи, кнопки и т.д.).
//
// Сортировка по клику на заголовок — поведение по умолчанию: таблица сама хранит состояние
// и сортирует данные (неконтролируемый режим). Если передан `onSort` — режим контролируемый:
// состояние сортировки и порядок строк задаёт вызывающая страница (см. раздел «Экспертизы»).
import { useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { Checkbox } from '../Form';
import { Icon } from '../Icon';
import styles from './Table.module.css';

export interface TableColumn<T> {
  /** Уникальный ключ колонки. */
  key: string;
  header: ReactNode;
  /** Кастомный рендер ячейки; по умолчанию — строка по data[recordKey]. */
  render?: (row: T, index: number) => ReactNode;
  /** Ключ поля данных для дефолтного рендера. */
  field?: keyof T & string;
  width?: string;
  /** Запретить сортировку по этой колонке (служебные столбцы, действия). */
  sortable?: boolean;
  /** Значение для сортировки; если не задано — берётся из `field`. */
  sortValue?: (row: T) => string | number | null | undefined;
}

export interface TableSelection<T> {
  isSelected: (row: T) => boolean;
  onToggle: (row: T) => void;
  header?: ReactNode;
  /** Выбрать/снять всё. Если задано — в шапке появляется чекбокс. */
  onToggleAll?: () => void;
  allSelected?: boolean;
  someSelected?: boolean;
}

type SortState = { key: string; direction: 'asc' | 'desc' } | null;

export interface TableProps<T> {
  columns: TableColumn<T>[];
  data: T[];
  /** Ключ записи для React key; по умолчанию index. */
  rowKey?: (row: T, index: number) => string | number;
  onRowClick?: (row: T, index: number) => void;
  emptyText?: string;
  separateBorders?: boolean;
  selection?: TableSelection<T>;

  // --- Сортировка: неконтролируемая по умолчанию, контролируемая при `onSort` ---

  /** Запретить сортировку целиком (например, при ручном порядке перетаскиванием). */
  sortable?: boolean;
  /** Текущий ключ сортировки (контролируемый режим). */
  sortKey?: string | null;
  sortDirection?: 'asc' | 'desc';
  onSort?: (key: string) => void;

  // --- drag-reorder и кастомная подсветка строк ---

  /** Класс строки. Мержится с внутренним `clickable`. */
  rowClassName?: (row: T, index: number) => string | undefined;
  /** Inline-стили строки (для transform во время перетаскивания). */
  rowStyle?: (row: T, index: number) => CSSProperties | undefined;
}

/** Сравнение значений: числа — численно, остальное — строкой (ru, с учётом чисел). */
function compareValues(left: string | number | null | undefined, right: string | number | null | undefined): number {
  if (left == null && right == null) return 0;
  if (left == null) return 1;
  if (right == null) return -1;
  if (typeof left === 'number' && typeof right === 'number') return left - right;
  return String(left).localeCompare(String(right), 'ru', { numeric: true, sensitivity: 'base' });
}

/** Цикл сортировки по клику: asc → desc → без сортировки. */
function cycleSort(current: SortState, key: string): SortState {
  if (!current || current.key !== key) return { key, direction: 'asc' };
  if (current.direction === 'asc') return { key, direction: 'desc' };
  return null;
}

export function Table<T>({
  columns,
  data,
  rowKey,
  onRowClick,
  emptyText = 'Нет данных',
  separateBorders,
  selection,
  sortable = true,
  sortKey,
  sortDirection = 'asc',
  onSort,
  rowClassName,
  rowStyle,
}: TableProps<T>) {
  const [internalSort, setInternalSort] = useState<SortState>(null);
  const controlled = Boolean(onSort);
  const activeSort: SortState = controlled
    ? sortKey
      ? { key: sortKey, direction: sortDirection }
      : null
    : internalSort;

  // В неконтролируемом режиме таблица сортирует данные сама.
  const rows = useMemo(() => {
    if (controlled || !activeSort || !sortable) return data;
    const column = columns.find((item) => item.key === activeSort.key);
    if (!column) return data;
    const valueOf = (row: T): string | number | null | undefined => {
      if (column.sortValue) return column.sortValue(row);
      if (column.field) return row[column.field] as unknown as string | number | null | undefined;
      return '';
    };
    const factor = activeSort.direction === 'asc' ? 1 : -1;
    return [...data].sort((a, b) => compareValues(valueOf(a), valueOf(b)) * factor);
  }, [data, columns, controlled, activeSort, sortable]);

  const keyOf = (row: T, index: number) => rowKey?.(row, index) ?? index;
  const totalColumns = columns.length + (selection ? 1 : 0);

  const handleSort = (key: string) => {
    if (!sortable) return;
    if (controlled) {
      onSort?.(key);
      return;
    }
    setInternalSort((prev) => cycleSort(prev, key));
  };

  const headerFor = (column: TableColumn<T>) => {
    const canSort = sortable && column.sortable !== false;
    if (!canSort) return column.header;
    const active = activeSort?.key === column.key;
    return (
      <button
        type="button"
        className={active ? `${styles.sortButton} ${styles.sortButtonActive}` : styles.sortButton}
        onClick={(event) => {
          event.stopPropagation();
          handleSort(column.key);
        }}
        aria-label={`Сортировать по колонке «${typeof column.header === 'string' ? column.header : column.key}»`}
      >
        {column.header}
        {active ? (
          <Icon name={activeSort?.direction === 'asc' ? 'arrow-up' : 'arrow-down'} size={13} className={styles.sortIcon} />
        ) : null}
      </button>
    );
  };

  return (
    <div className={styles.wrapper}>
      <table className={[styles.table, separateBorders ? styles.tableSeparate : ''].filter(Boolean).join(' ')}>
        <thead>
          <tr>
            {selection ? (
              <th className={styles.checkCell}>
                {selection.onToggleAll ? (
                  <input
                    type="checkbox"
                    className={styles.selectAllCheckbox}
                    checked={Boolean(selection.allSelected)}
                    ref={(element) => {
                      if (element) element.indeterminate = Boolean(selection.someSelected) && !selection.allSelected;
                    }}
                    onChange={() => selection.onToggleAll?.()}
                    aria-label="Выбрать все"
                  />
                ) : (
                  selection.header ?? null
                )}
              </th>
            ) : null}
            {columns.map((column) => {
              const canSort = sortable && column.sortable !== false;
              const active = activeSort?.key === column.key;
              const ariaSort = !canSort || !active ? undefined : activeSort?.direction === 'asc' ? 'ascending' : 'descending';
              return (
                <th key={column.key} style={column.width ? { width: column.width } : undefined} aria-sort={ariaSort}>
                  {headerFor(column)}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td className={styles.empty} colSpan={totalColumns}>
                {emptyText}
              </td>
            </tr>
          ) : (
            rows.map((row, index) => {
              const external = rowClassName?.(row, index);
              const classes = [onRowClick ? styles.clickable : '', external ?? ''].filter(Boolean).join(' ');
              return (
                <tr
                  key={keyOf(row, index)}
                  className={classes || undefined}
                  style={rowStyle?.(row, index)}
                  onClick={onRowClick ? () => onRowClick(row, index) : undefined}
                  role={onRowClick ? 'button' : undefined}
                  tabIndex={onRowClick ? 0 : undefined}
                  onKeyDown={
                    onRowClick
                      ? (event) => {
                          if (event.key === 'Enter') {
                            onRowClick(row, index);
                          } else if (event.key === ' ' || event.key === 'Space') {
                            event.preventDefault();
                            onRowClick(row, index);
                          }
                        }
                      : undefined
                  }
                >
                  {selection ? (
                    <td className={styles.checkCell} onClick={(event) => event.stopPropagation()}>
                      <Checkbox
                        label=""
                        checked={selection.isSelected(row)}
                        onChange={() => selection.onToggle(row)}
                      />
                    </td>
                  ) : null}
                  {columns.map((column) => (
                    <td key={column.key}>
                      {column.render
                        ? column.render(row, index)
                        : column.field
                          ? String((row as Record<string, unknown>)[column.field] ?? '')
                          : null}
                    </td>
                  ))}
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
