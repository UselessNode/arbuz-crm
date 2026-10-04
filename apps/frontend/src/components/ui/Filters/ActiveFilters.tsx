// Активные фильтры: чипы с удалением по одному + «Сбросить всё».
import { Icon } from '../Icon';
import type { ActiveFilter } from '../DataView/types';
import styles from './Filters.module.css';

export interface ActiveFiltersProps {
  filters: ActiveFilter[];
  onRemove: (filter: ActiveFilter) => void;
  onResetAll: () => void;
}

export function ActiveFilters({ filters, onRemove, onResetAll }: ActiveFiltersProps) {
  if (filters.length === 0) return null;

  return (
    <div className={styles.chips}>
      {filters.map((filter) => (
        <span key={filter.key} className={styles.chip}>
          <span className={styles.chipLabel}>{filter.label}:</span>
          <span className={styles.chipValue}>{filter.text}</span>
          <button
            type="button"
            className={styles.chipRemove}
            aria-label={`Убрать фильтр «${filter.label}: ${filter.text}»`}
            onClick={() => onRemove(filter)}
          >
            <Icon name="close" size={12} />
          </button>
        </span>
      ))}
      <button type="button" className={styles.chipsReset} onClick={onResetAll}>
        Сбросить всё
      </button>
    </div>
  );
}
