// Бейдж: слово/метка с цветовым тоном. Статус-бейдж — вариант для
// ролей/статусов/вердиктов, умеет превращаться в выпадающий список смены статуса.
import type { ReactNode, SelectHTMLAttributes } from 'react';
import type { RoleType } from '@arbuz/shared';
import { Icon, type IconName } from '../Icon';
import styles from './Badge.module.css';

export type BadgeTone =
  | 'neutral'
  | 'gray'
  | 'blue'
  | 'sky'
  | 'cyan'
  | 'teal'
  | 'green'
  | 'lime'
  | 'yellow'
  | 'amber'
  | 'orange'
  | 'red'
  | 'rose'
  | 'pink'
  | 'fuchsia'
  | 'purple'
  | 'violet'
  | 'indigo';

/** Все допустимые тона (для валидации значений, пришедших из API/БД). */
export const BADGE_TONES: readonly BadgeTone[] = [
  'neutral',
  'gray',
  'blue', 'sky', 'cyan', 'teal',
  'green', 'lime',
  'yellow', 'amber', 'orange',
  'red', 'rose', 'pink',
  'fuchsia', 'purple', 'violet',
  'indigo',
];

/** Палитра для хеш-выбора: без 'neutral' (он — fallback для «—»/пустых). */
const HASHABLE_TONES: readonly BadgeTone[] = BADGE_TONES.filter((tone) => tone !== 'neutral');

/** Безопасно приводит тон из API/БД к BadgeTone (неизвестный → neutral). */
export function toBadgeTone(value: string | null | undefined): BadgeTone {
  return (BADGE_TONES as readonly string[]).includes(value ?? '') ? (value as BadgeTone) : 'neutral';
}

/**
 * Детерминированно подбирает тон по произвольной строке (FNV-1a).
 * Одна и та же строка → всегда один и тот же тон; разные строки с высокой
 * вероятностью дают разные тона. Не криптография — чисто декоративно.
 *
 * Опциональный хелпер: нигде не обязателен, для мест, где `tone` уже задан
 * явно (ROLE_OPTIONS и т.п.), ничего не меняет.
 */
export function toneFromString(value: string): BadgeTone {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return HASHABLE_TONES[(hash >>> 0) % HASHABLE_TONES.length];
}

export interface BadgeProps {
  tone?: BadgeTone;
  icon?: IconName;
  className?: string;
  children: ReactNode;
}

export function Badge({ tone = 'neutral', icon, className, children }: BadgeProps) {
  return (
    <span className={`${styles.badge} ${styles[tone]} ${className ?? ''}`}>
      {icon ? <Icon name={icon} size={13} /> : null}
      {children}
    </span>
  );
}

export interface StatusOption<V extends string> {
  value: V;
  label: string;
  tone: BadgeTone;
  /** Опциональная иконка для статичного бейджа. */
  icon?: IconName;
}

export interface StatusBadgeProps<V extends string>
  extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'onChange' | 'value'> {
  value: V;
  options: readonly StatusOption<V>[];
  /** Если задан — бейдж становится выпадающим списком для смены статуса. */
  onChange?: (value: V) => void;
}

export function StatusBadge<V extends string>({
  value,
  options,
  onChange,
  className,
  'aria-label': ariaLabel,
  ...rest
}: StatusBadgeProps<V>) {
  const current = options.find((option) => option.value === value) ?? {
    value,
    label: value,
    tone: 'neutral' as BadgeTone,
  };

  if (!onChange) {
    return (
      <Badge tone={current.tone} icon={current.icon}>
        {current.label}
      </Badge>
    );
  }

  return (
    <span className={`${styles.selectWrap} ${styles[current.tone]}`}>
      <select
        className={`${styles.select} ${className ?? ''}`}
        value={value}
        onChange={(event) => onChange(event.target.value as V)}
        aria-label={ariaLabel ?? 'Сменить значение'}
        {...rest}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <Icon name="chevron-down" size={12} className={styles.selectIcon} />
    </span>
  );
}

// --- Карты статусов (типы — из @arbuz/shared, метки/цвета — локальные) ---

export const ROLE_OPTIONS: readonly StatusOption<RoleType>[] = [
  { value: 'admin',     label: 'Админ',     tone: 'red' },
  { value: 'expert',    label: 'Эксперт',   tone: 'purple' },
  { value: 'applicant', label: 'Заявитель', tone: 'gray' },
];

// Статусы заявок и вердикты экспертиз — редактируемые справочники: они приходят
// с сервера (`GET /api/application-statuses`, `GET /api/review-statuses`),
// а не задаются здесь (см. ApplicationsPage / ApplicationDetailPage / Настройки экспертизы).
