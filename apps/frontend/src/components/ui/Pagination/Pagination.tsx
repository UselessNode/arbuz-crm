// Пагинация списков: диапазон, размер страницы, навигация.
import { Button } from '../Button';
import { Select } from '../Form';
import styles from './Pagination.module.css';

export interface PaginationProps {
  page: number; // 1-based
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  pageSizeOptions?: readonly number[];
}

const DEFAULT_PAGE_SIZES = [20, 50, 100];

export function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = DEFAULT_PAGE_SIZES,
}: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div className={styles.wrapper}>
      <span className={styles.range}>
        {total === 0 ? 'Нет записей' : `Показано ${from}–${to} из ${total}`}
      </span>
      <div className={styles.controls}>
        {onPageSizeChange ? (
          <Select
            className={styles.pageSize}
            value={String(pageSize)}
            onChange={(value) => {
              onPageSizeChange(Number(value));
              onPageChange(1);
            }}
            options={pageSizeOptions.map((size) => ({ value: String(size), label: `${size} / стр.` }))}
          />
        ) : null}
        <Button variant="secondary" size="sm" icon="chevron-left" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
          Назад
        </Button>
        <span className={styles.pageLabel}>
          {page} / {totalPages}
        </span>
        <Button
          variant="secondary"
          size="sm"
          icon="chevron-right"
          iconPosition="end"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          Вперёд
        </Button>
      </div>
    </div>
  );
}
