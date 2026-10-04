// Таблица: колонки с произвольным рендером ячеек (можно вкладывать бейджи, кнопки и т.д.).
import type { CSSProperties, ReactNode } from 'react';
import { Checkbox } from '../Form';
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
}

export interface TableSelection<T> {
  isSelected: (row: T) => boolean;
  onToggle: (row: T) => void;
  header?: ReactNode;
}

export interface TableProps<T> {
  columns: TableColumn<T>[];
  data: T[];
  /** Ключ записи для React key; по умолчанию index. */
  rowKey?: (row: T, index: number) => string | number;
  onRowClick?: (row: T, index: number) => void;
  emptyText?: string;
  separateBorders?: boolean;
  selection?: TableSelection<T>;
  sortKey?: string | null;
  sortDirection?: 'asc' | 'desc';
  onSort?: (key: string) => void;

  // --- Новое для drag-reorder и кастомной подсветки строк ---

  /** Класс строки. Мержится с внутренним `clickable`. */
  rowClassName?: (row: T, index: number) => string | undefined;
  /** Inline-стили строки (для transform во время перетаскивания). */
  rowStyle?: (row: T, index: number) => CSSProperties | undefined;
}

export function Table<T>({
  columns,
  data,
  rowKey,
  onRowClick,
  emptyText = 'Нет данных',
  selection,
  sortKey,
  sortDirection = 'asc',
  onSort,
  rowClassName,
  rowStyle,
}: TableProps<T>) {
  const keyOf = (row: T, index: number) => rowKey?.(row, index) ?? index;
  const totalColumns = columns.length + (selection ? 1 : 0);

  const headerFor = (column: TableColumn<T>) => {
    const sortable = Boolean(onSort) && column.sortable !== false;
    if (!sortable) return column.header;
    const active = sortKey === column.key;
    return (
      <button
        type="button"
        className={active ? `${styles.sortButton} ${styles.sortButtonActive}` : styles.sortButton}
        onClick={(event) => {
          event.stopPropagation();
          onSort?.(column.key);
        }}
        aria-label={`Сортировать по колонке «${typeof column.header === 'string' ? column.header : column.key}»`}
      >
        {column.header}
        <span className={styles.sortMark} aria-hidden="true">
          {active ? (sortDirection === 'asc' ? '▲' : '▼') : '↕'}
        </span>
      </button>
    );
  };

  return (
    <div className={styles.wrapper}>
      <table className={styles.table}>
        <thead>
          <tr>
            {selection ? <th className={styles.checkCell}>{selection.header ?? null}</th> : null}
            {columns.map((column) => {
              const active = sortKey === column.key;
              const ariaSort = !onSort || column.sortable === false || !active
                ? undefined
                : sortDirection === 'asc'
                  ? 'ascending'
                  : 'descending';
              return (
                <th key={column.key} style={column.width ? { width: column.width } : undefined} aria-sort={ariaSort}>
                  {headerFor(column)}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td className={styles.empty} colSpan={totalColumns}>
                {emptyText}
              </td>
            </tr>
          ) : (
            data.map((row, index) => {
              const external = rowClassName?.(row, index);
              const classes = [onRowClick ? styles.clickable : '', external ?? '']
                .filter(Boolean)
                .join(' ');
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
