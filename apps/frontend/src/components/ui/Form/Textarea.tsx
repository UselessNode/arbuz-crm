// Многострочное поле ввода (например, Markdown).
import { useId, type ReactNode, type TextareaHTMLAttributes } from 'react';
import styles from './Form.module.css';

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: ReactNode;
  error?: ReactNode;
  hint?: ReactNode;
}

export function Textarea({ label, error, hint, id, className, ...rest }: TextareaProps) {
  const autoId = useId();
  const textareaId = id ?? autoId;
  const classes = [styles.textarea, error ? styles.inputError : '', className ?? ''].filter(Boolean).join(' ');

  return (
    <label className={styles.field} htmlFor={textareaId}>
      {label ? <span className={styles.label}>{label}</span> : null}
      <textarea id={textareaId} className={classes} aria-invalid={Boolean(error)} {...rest} />
      {error ? <span className={styles.error}>{error}</span> : hint ? <span className={styles.hint}>{hint}</span> : null}
    </label>
  );
}
