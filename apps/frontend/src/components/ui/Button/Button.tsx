// Кнопка: варианты, размеры, иконка в начале/конце, состояние загрузки.
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Icon, type IconName } from '../Icon';
import styles from './Button.module.css';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: IconName;
  iconPosition?: 'start' | 'end';
  loading?: boolean;
  fullWidth?: boolean;
  children?: ReactNode;
}

export function Button({
  variant = 'primary',
  size = 'md',
  icon,
  iconPosition = 'start',
  loading = false,
  fullWidth = false,
  className,
  disabled,
  children,
  ...rest
}: ButtonProps) {
  const classes = [
    styles.button,
    styles[variant],
    styles[size],
    fullWidth ? styles.fullWidth : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  const iconNode = loading ? (
    <Icon name="info" size={size === 'sm' ? 14 : 16} />
  ) : icon ? (
    <Icon name={icon} size={size === 'sm' ? 14 : 16} />
  ) : null;

  return (
    <button type="button" className={classes} disabled={disabled || loading} {...rest}>
      {iconPosition === 'start' && iconNode}
      {children !== undefined && children !== null && children !== '' ? <span className={styles.label}>{children}</span> : null}
      {iconPosition === 'end' && iconNode}
    </button>
  );
}
