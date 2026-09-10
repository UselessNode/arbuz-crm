// Слайдер ввода значений с отображением текущего значения.
import { useId, type ReactNode } from 'react';
import styles from './Form.module.css';

export interface SliderProps {
  label?: ReactNode;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  /** Подпись единицы измерения/формат значения. */
  formatValue?: (value: number) => string;
}

export function Slider({ label, value, onChange, min = 0, max = 100, step = 1, formatValue }: SliderProps) {
  const autoId = useId();
  const inputId = `slider-${autoId}`;

  return (
    <span className={styles.field}>
      {label ? (
        <span className={styles.sliderHeader}>
          <span className={styles.label}>{label}</span>
          <span className={styles.sliderValue}>{formatValue ? formatValue(value) : value}</span>
        </span>
      ) : null}
      <input
        id={inputId}
        type="range"
        className={styles.slider}
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </span>
  );
}
