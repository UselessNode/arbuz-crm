// Чекбокс формы.
import type { ReactNode } from 'react';
import styles from './Form.module.css';

export interface CheckboxProps {
  label?: ReactNode;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

export function Checkbox({ label, checked, onChange, disabled = false }: CheckboxProps) {
  return (
    <label className={styles.checkbox}>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} />
      {label ? <span>{label}</span> : null}
    </label>
  );
}
