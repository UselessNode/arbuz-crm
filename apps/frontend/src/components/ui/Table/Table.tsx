// Таблица: колонки с произвольным рендером ячеек (можно вкладывать бейджи, кнопки и т.д.).
import type { ReactNode } from 'react';
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
}

export interface TableProps<T> {
  columns: TableColumn<T>[];
  data: T[];
  /** Ключ записи для React key; по умолчанию index. */
  rowKey?: (row: T, index: number) => string | number;
  onRowClick?: (row: T, index: number) => void;
  emptyText?: string;
}

export function Table<T>({ columns, data, rowKey, onRowClick, emptyText = 'Нет данных' }: TableProps<T>) {
  const keyOf = (row: T, index: number) => rowKey?.(row, index) ?? index;

  return (
    <div className={styles.wrapper}>
      <table className={styles.table}>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key} style={column.width ? { width: column.width } : undefined}>
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td className={styles.empty} colSpan={columns.length}>
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
