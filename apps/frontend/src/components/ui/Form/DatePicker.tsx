// Выбор даты (календарь): нативный date input + иконка.
import { useId, type ReactNode } from 'react';
import { Icon } from '../Icon';
import styles from './Form.module.css';

export interface DatePickerProps {
  label?: ReactNode;
  error?: ReactNode;
  value: string; // формат yyyy-mm-dd (нативный input[type=date])
  onChange: (value: string) => void;
  min?: string;
  max?: string;
  disabled?: boolean;
}

export function DatePicker({ label, error, value, onChange, min, max, disabled = false }: DatePickerProps) {
  const autoId = useId();
  const inputId = `date-${autoId}`;

  return (
    <label className={styles.field} htmlFor={inputId}>
      {label ? <span className={styles.label}>{label}</span> : null}
      <span className={styles.inputWrap}>
        <input
          id={inputId}
          type="date"
          className={`${styles.input} ${styles.dateInput} ${error ? styles.inputError : ''}`}
          value={value}
          min={min}
          max={max}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          aria-invalid={Boolean(error)}
        />
        <Icon name="calendar" size={15} className={styles.inputIcon} />
      </span>
      {error ? <span className={styles.error}>{error}</span> : null}
    </label>
  );
}
