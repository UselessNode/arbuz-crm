// Слайдер ввода значений: шкала + числовое поле для точного ввода.
import { useId, type ChangeEvent, type CSSProperties, type ReactNode } from 'react';
import styles from './Form.module.css';

export interface SliderProps {
  label?: ReactNode;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  className?: string;
}

export function Slider({ label, value, onChange, min = 0, max = 100, step = 1, className }: SliderProps) {
  const autoId = useId();
  const inputId = `slider-${autoId}`;
  const labelId = `slider-label-${autoId}`;

  // Процент заполнения шкалы — передаём в CSS-переменную --progress.
  const progress = ((value - min) / (max - min)) * 100;

  const handleNumberChange = (event: ChangeEvent<HTMLInputElement>) => {
    const next = Number(event.target.value);
    if (Number.isNaN(next)) return;
    onChange(Math.max(min, Math.min(max, next)));
  };

  return (
    <div className={`${styles.field} ${className ?? ''}`}>
      <div className={styles.sliderHeader}>
        {label ? (
          <label htmlFor={inputId} id={labelId} className={styles.label}>
            {label}
          </label>
        ) : null}

        <div className={styles.sliderInputWrapper}>
          <input
            type="number"
            className={styles.sliderNumberInput}
            value={value}
            min={min}
            max={max}
            step={step}
            onChange={handleNumberChange}
          />
          <span className={styles.sliderUnit}>из {max}</span>
        </div>
      </div>

      <input
        id={inputId}
        type="range"
        className={styles.slider}
        value={value}
        min={min}
        max={max}
        step={step}
        aria-labelledby={label ? labelId : undefined}
        style={{ '--progress': `${progress}%` } as CSSProperties}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </div>
  );
}
