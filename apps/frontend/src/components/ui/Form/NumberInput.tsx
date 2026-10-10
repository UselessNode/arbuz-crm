// Числовое поле ввода: простой input с типом number (без кнопок «±»).
// Числа вводятся вручную; на бэкенде ограничения всё равно проверяются.
import { useId, type ReactNode } from 'react';
import styles from './Form.module.css';

export interface NumberInputProps {
  label?: ReactNode;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  /** Растянуть поле на всю ширину контейнера. */
  fullWidth?: boolean;
  placeholder?: string;
}

export function NumberInput({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  disabled = false,
  fullWidth = false,
  placeholder,
}: NumberInputProps) {
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

  const fieldClasses = [styles.field, fullWidth ? styles.fullWidth : ''].filter(Boolean).join(' ');

  return (
    <label className={fieldClasses} htmlFor={inputId}>
      {label ? <span className={styles.label}>{label}</span> : null}
      <input
        id={inputId}
        type="number"
        className={styles.input}
        value={value}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        placeholder={placeholder}
        inputMode="numeric"
        onChange={(event) => handleChange(event.target.value)}
      />
    </label>
  );
}
