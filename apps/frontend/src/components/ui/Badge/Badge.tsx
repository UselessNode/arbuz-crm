// Бейдж: слово/метка с цветовым тоном. Статус-бейдж — вариант для
// ролей/статусов/вердиктов, умеет превращаться в выпадающий список смены статуса.
import type { ReactNode, SelectHTMLAttributes } from 'react';
import type { RoleType, ReviewStatus } from '@arbuz/shared';
import { Icon, type IconName } from '../Icon';
import styles from './Badge.module.css';

export type BadgeTone = 'neutral' | 'blue' | 'green' | 'yellow' | 'red' | 'purple' | 'gray';

export interface BadgeProps {
  tone?: BadgeTone;
  icon?: IconName;
  children: ReactNode;
}

export function Badge({ tone = 'neutral', icon, children }: BadgeProps) {
  return (
    <span className={`${styles.badge} ${styles[tone]}`}>
      {icon ? <Icon name={icon} size={13} /> : null}
      {children}
    </span>
  );
}

export interface StatusOption<V extends string> {
  value: V;
  label: string;
  tone: BadgeTone;
}

export interface StatusBadgeProps<V extends string> extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'onChange' | 'value'> {
  value: V;
  options: readonly StatusOption<V>[];
  /** Если задан — бейдж становится выпадающим списком для смены статуса. */
  onChange?: (value: V) => void;
}

export function StatusBadge<V extends string>({ value, options, onChange, className, ...rest }: StatusBadgeProps<V>) {
  const current = options.find((option) => option.value === value) ?? {
    value,
    label: value,
    tone: 'neutral' as BadgeTone,
  };

  if (!onChange) {
    return (
      <Badge tone={current.tone} icon={value === 'draft' ? 'edit' : value === 'approved' ? 'check' : undefined}>
        {current.label}
      </Badge>
    );
  }

  return (
    <select
      className={`${styles.select} ${styles[current.tone]} ${className ?? ''}`}
      value={value}
      onChange={(event) => onChange(event.target.value as V)}
      aria-label="Сменить статус"
      {...rest}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

// --- Карты статусов (типы — из @arbuz/shared, метки/цвета — локальные) ---

export const ROLE_OPTIONS: readonly StatusOption<RoleType>[] = [
  { value: 'admin', label: 'Админ', tone: 'red' },
  { value: 'expert', label: 'Эксперт', tone: 'purple' },
  { value: 'applicant', label: 'Заявитель', tone: 'blue' },
];

export const VERDICT_OPTIONS: readonly StatusOption<ReviewStatus>[] = [
  { value: 'draft', label: 'Черновик', tone: 'gray' },
  { value: 'approved', label: 'Одобрено', tone: 'green' },
  { value: 'rejected', label: 'Отклонено', tone: 'red' },
];

export const APPLICATION_STATUS_OPTIONS: readonly StatusOption<string>[] = [
  { value: 'draft', label: 'Черновик', tone: 'gray' },
  { value: 'under_review', label: 'На проверке', tone: 'yellow' },
  { value: 'accepted', label: 'Принята', tone: 'green' },
  { value: 'rejected', label: 'Отклонена', tone: 'red' },
];
