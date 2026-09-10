// Поле ввода чисел: min/max/step и кнопки «±».
import { useId, type ReactNode } from 'react';
import { Icon } from '../Icon';
import styles from './Form.module.css';

export interface NumberInputProps {
  label?: ReactNode;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
}

export function NumberInput({ label, value, onChange, min, max, step = 1, disabled = false }: NumberInputProps) {
  const autoId = useId();
  const inputId = `number-${autoId}`;

  const clamp = (next: number) => {
    let result = next;
    if (min !== undefined) result = Math.max(min, result);
    if (max !== undefined) result = Math.min(max, result);
    return result;
  };

  const handleChange = (raw: string) => {
    if (raw === '') {
      onChange(0);
      return;
    }
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) return;
    onChange(clamp(parsed));
  };

  return (
    <span className={styles.field}>
      {label ? <span className={styles.label}>{label}</span> : null}
      <span className={styles.numberWrap}>
        <button type="button" className={styles.stepButton} onClick={() => onChange(clamp(value - step))} disabled={disabled} aria-label="Уменьшить">
          <Icon name="minus" size={14} />
        </button>
        <input
          id={inputId}
          type="number"
          className={styles.numberInput}
          value={value}
          min={min}
          max={max}
          step={step}
          disabled={disabled}
          onChange={(event) => handleChange(event.target.value)}
        />
        <button type="button" className={styles.stepButton} onClick={() => onChange(clamp(value + step))} disabled={disabled} aria-label="Увеличить">
          <Icon name="plus" size={14} />
        </button>
      </span>
    </span>
  );
}
