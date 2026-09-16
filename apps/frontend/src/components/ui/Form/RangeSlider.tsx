// Ползунок с двумя границами: выбор диапазона числовых значений.
//
// Реализация — два наложенных друг на друга нативных `input[type=range]`
// (стандартный приём для двойного ползунка): каждый остаётся доступным с клавиатуры,
// а тянутся только их бегунки (`pointer-events` в CSS).
import { useId, type ChangeEvent, type CSSProperties, type ReactNode } from 'react';
import { moveRangeHandle, rangePercent, type NumericRange } from './range-state';
import styles from './Form.module.css';

export interface RangeSliderProps {
  label?: ReactNode;
  value: NumericRange;
  onChange: (value: NumericRange) => void;
  min?: number;
  max?: number;
  step?: number;
  /** Единица измерения в полях ввода («из N» не показываем — границы задаёт пользователь). */
  unit?: string;
  className?: string;
}

export function RangeSlider({
  label,
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  unit,
  className,
}: RangeSliderProps) {
  const autoId = useId();
  const fromId = `range-from-${autoId}`;
  const toId = `range-to-${autoId}`;
  const bounds = { min, max, step };

  const move = (handle: 'from' | 'to') => (event: ChangeEvent<HTMLInputElement>) =>
    onChange(moveRangeHandle(value, handle, Number(event.target.value), bounds));

  const setNumber = (handle: 'from' | 'to') => (event: ChangeEvent<HTMLInputElement>) => {
    const next = Number(event.target.value);
    if (Number.isNaN(next)) return;
    onChange(moveRangeHandle(value, handle, next, bounds));
  };

  const fromPercent = rangePercent(value.from, min, max);
  const toPercent = rangePercent(value.to, min, max);

  return (
    <div className={`${styles.field} ${className ?? ''}`}>
      <div className={styles.sliderHeader}>
        {label ? <span className={styles.label}>{label}</span> : null}
        <div className={styles.rangeInputs}>
          <label className={styles.rangeNumberLabel} htmlFor={fromId}>
            от
          </label>
          <input
            id={fromId}
            type="number"
            className={styles.sliderNumberInput}
            value={value.from}
            min={min}
            max={max}
            step={step}
            onChange={setNumber('from')}
          />
          <label className={styles.rangeNumberLabel} htmlFor={toId}>
            до
          </label>
          <input
            id={toId}
            type="number"
            className={styles.sliderNumberInput}
            value={value.to}
            min={min}
            max={max}
            step={step}
            onChange={setNumber('to')}
          />
          {unit ? <span className={styles.sliderUnit}>{unit}</span> : null}
        </div>
      </div>

      <div className={styles.rangeSlider}>
        <div className={styles.rangeTrack} aria-hidden="true">
          <div
            className={styles.rangeFill}
            style={{ left: `${fromPercent}%`, width: `${Math.max(toPercent - fromPercent, 0)}%` }}
          />
        </div>
        <input
          type="range"
          className={`${styles.rangeInput} ${styles.rangeInputFrom}`}
          value={value.from}
          min={min}
          max={max}
          step={step}
          aria-label={label ? `${String(label)}: от` : 'Начало диапазона'}
          onChange={move('from')}
          // Когда границы сходятся на максимуме, верхний бегунок должен быть «от»,
          // иначе его невозможно сдвинуть обратно.
          style={{ zIndex: value.from >= max ? 4 : 2 } as CSSProperties}
        />
        <input
          type="range"
          className={`${styles.rangeInput} ${styles.rangeInputTo}`}
          value={value.to}
          min={min}
          max={max}
          step={step}
          aria-label={label ? `${String(label)}: до` : 'Конец диапазона'}
          onChange={move('to')}
        />
      </div>
    </div>
  );
}
