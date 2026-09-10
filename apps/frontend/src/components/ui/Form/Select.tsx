// Выпадающий список (форма): label, ошибка, плейсхолдер.
import { useId, type ReactNode, type SelectHTMLAttributes } from 'react';
import styles from './Form.module.css';

export interface SelectOption<V extends string> {
  value: V;
  label: string;
}

export interface SelectProps<V extends string> extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'onChange' | 'value'> {
  label?: ReactNode;
  error?: ReactNode;
  options: readonly SelectOption<V>[];
  value: V | '';
  onChange: (value: string) => void;
  placeholder?: string;
}

export function Select<V extends string>({
  label,
  error,
  options,
  value,
  onChange,
  placeholder,
  id,
  className,
  ...rest
}: SelectProps<V>) {
  const autoId = useId();
  const selectId = id ?? autoId;
  const classes = [styles.select, error ? styles.inputError : '', className ?? ''].filter(Boolean).join(' ');

  return (
    <label className={styles.field} htmlFor={selectId}>
      {label ? <span className={styles.label}>{label}</span> : null}
      <select id={selectId} className={classes} value={value} onChange={(event) => onChange(event.target.value)} {...rest}>
        {placeholder ? <option value="">{placeholder}</option> : null}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error ? <span className={styles.error}>{error}</span> : null}
    </label>
  );
}
