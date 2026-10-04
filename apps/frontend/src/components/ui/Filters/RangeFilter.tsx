// Числовой фильтр «диапазон»: двухсторонний слайдер + поля точного ввода.
import { RangeSlider } from '../Form';
import type { RangeValue } from '../DataView/types';
import styles from './Filters.module.css';

export interface RangeFilterProps {
  label: string;
  value: RangeValue;
  onChange: (value: RangeValue) => void;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
}

export function RangeFilter({ label, value, onChange, min = 0, max = 100, step = 1, unit }: RangeFilterProps) {
  const from = value.min ?? min;
  const to = value.max ?? max;
  const isFull = from <= min && to >= max;

  return (
    <div className={styles.filterItem}>
      <span className={styles.filterLabel}>{label}</span>
      <div className={styles.rangeWrap}>
        <RangeSlider
          value={{ from, to }}
          onChange={(next) => {
            const full = next.from <= min && next.to >= max;
            onChange(full ? { min: null, max: null } : { min: next.from, max: next.to });
          }}
          min={min}
          max={max}
          step={step}
          unit={unit}
        />
        {!isFull ? (
          <button type="button" className={styles.rangeReset} onClick={() => onChange({ min: null, max: null })}>
            Сбросить диапазон
          </button>
        ) : null}
      </div>
    </div>
  );
}
