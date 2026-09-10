// Поле ввода текста: label, подсказка, ошибка, иконка.
import { useId, type InputHTMLAttributes, type ReactNode } from 'react';
import { Icon, type IconName } from '../Icon';
import styles from './Form.module.css';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: ReactNode;
  error?: ReactNode;
  hint?: ReactNode;
  icon?: IconName;
}

export function Input({ label, error, hint, icon, id, className, ...rest }: InputProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const classes = [styles.input, icon ? styles.inputWithIcon : '', error ? styles.inputError : '', className ?? '']
    .filter(Boolean)
    .join(' ');

  return (
    <label className={styles.field} htmlFor={inputId}>
      {label ? <span className={styles.label}>{label}</span> : null}
      <span className={styles.inputWrap}>
        {icon ? <Icon name={icon} size={15} className={styles.inputIcon} /> : null}
        <input id={inputId} className={classes} aria-invalid={Boolean(error)} {...rest} />
      </span>
      {error ? <span className={styles.error}>{error}</span> : hint ? <span className={styles.hint}>{hint}</span> : null}
    </label>
  );
}
