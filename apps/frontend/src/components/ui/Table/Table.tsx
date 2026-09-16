// Таблица: колонки с произвольным рендером ячеек (можно вкладывать бейджи, кнопки и т.д.).
import type { ReactNode } from 'react';
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
  /**
   * Выбрана ли строка. Состояние выбора принадлежит вызывающей странице,
   * поэтому таблица не выводит ключи сама: раньше она сверяла их со своим
   * `rowKey`, и любое расхождение в типе (id-число против id-строки) тихо
   * ломало отметки.
   */
  isSelected: (row: T) => boolean;
  onToggle: (row: T) => void;
  /** Заголовок колонки выбора (пусто — только чекбоксы). */
  header?: ReactNode;
}

export interface TableProps<T> {
  columns: TableColumn<T>[];
  data: T[];
  /** Ключ записи для React key; по умолчанию index. */
  rowKey?: (row: T, index: number) => string | number;
  onRowClick?: (row: T, index: number) => void;
  emptyText?: string;
  /** Столбец чекбоксов (только для администратора — режим работы с выборкой). */
  selection?: TableSelection<T>;
  /** Колонка, по которой сейчас идёт сортировка (подсветка и aria-sort). */
  sortKey?: string | null;
  sortDirection?: 'asc' | 'desc';
  /** Клик по заголовку колонки: asc → desc → без сортировки. */
  onSort?: (key: string) => void;
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
            data.map((row, index) => (
              <tr
                key={keyOf(row, index)}
                className={onRowClick ? styles.clickable : undefined}
                onClick={onRowClick ? () => onRowClick(row, index) : undefined}
                role={onRowClick ? 'button' : undefined}
                tabIndex={onRowClick ? 0 : undefined}
                onKeyDown={
                  onRowClick
                    ? (event) => {
                        if (event.key === 'Enter') {
                          onRowClick(row, index);
                        } else if (event.key === ' ' || event.key === 'Space') {
                          // Space не должен прокручивать страницу.
                          event.preventDefault();
                          onRowClick(row, index);
                        }
                      }
                    : undefined
                }
              >
                {selection ? (
                  // Клик по чекбоксу не должен открывать строку — гасим всплытие.
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
                    {column.render ? column.render(row, index) : column.field ? String((row as Record<string, unknown>)[column.field] ?? '') : null}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
