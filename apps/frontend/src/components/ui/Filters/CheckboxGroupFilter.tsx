// Фасетный фильтр с множественным выбором (checkbox group).
// При 2–3 вариантах рисуется segmented-контрол (компактнее и нагляднее).
import { Checkbox } from '../Form';
import type { FilterOption } from '../DataView/types';
import styles from './Filters.module.css';

export interface CheckboxGroupFilterProps {
  label: string;
  options: readonly FilterOption[];
  value: string[];
  onChange: (value: string[]) => void;
  segmented?: boolean;
}

export function CheckboxGroupFilter({ label, options, value, onChange, segmented }: CheckboxGroupFilterProps) {
  const useSegmented = segmented ?? options.length <= 3;

  const toggle = (option: string) => {
    onChange(value.includes(option) ? value.filter((item) => item !== option) : [...value, option]);
  };

  return (
    <div className={styles.filterItem}>
      <span className={styles.filterLabel}>{label}</span>
      {useSegmented ? (
        <div className={styles.segmented} role="group" aria-label={label}>
          {options.map((option) => {
            const active = value.includes(option.value);
            return (
              <button
                key={option.value}
                type="button"
                className={`${styles.segmentedButton} ${active ? styles.segmentedActive : ''}`}
                aria-pressed={active}
                onClick={() => toggle(option.value)}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      ) : (
        <div className={styles.checkboxGroup} role="group" aria-label={label}>
          {options.map((option) => (
            <Checkbox
              key={option.value}
              label={option.label}
              checked={value.includes(option.value)}
              onChange={() => toggle(option.value)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
