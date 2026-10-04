// Бейдж: слово/метка с цветовым тоном. Статус-бейдж — вариант для
// ролей/статусов/вердиктов, умеет превращаться в выпадающий список смены статуса.
import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode, type SelectHTMLAttributes } from 'react';
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
  /** Подсказка при наведении; по умолчанию — текстовое содержимое. */
  title?: string;
  /** Максимальная ширина бейджа (число — px). Текст не переносится. */
  maxWidth?: number | string;
  children: ReactNode;
}

function toCssSize(value?: number | string): string | undefined {
  if (value === undefined) return undefined;
  return typeof value === 'number' ? `${value}px` : value;
}

/**
 * Бейдж не переносит текст и не растягивает строку таблицы. Если содержимое не
 * помещается в доступную ширину, оно прокручивается внутри бейджа (бегущая строка)
 * при наведении; полный текст доступен в подсказке (`title`).
 */
export function Badge({ tone = 'neutral', icon, className, title, maxWidth, children }: BadgeProps) {
  const wrapRef = useRef<HTMLSpanElement | null>(null);
  const textRef = useRef<HTMLSpanElement | null>(null);
  const [shift, setShift] = useState(0);

  // Измеряем переполнение текста относительно видимой области бейджа.
  useLayoutEffect(() => {
    const wrap = wrapRef.current;
    const text = textRef.current;
    if (!wrap || !text) {
      setShift(0);
      return;
    }
    const measure = () => setShift(Math.max(0, Math.ceil(text.scrollWidth - wrap.clientWidth)));
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(wrap);
    return () => observer.disconnect();
  }, [children, maxWidth]);

  const tooltip =
    title ?? (typeof children === 'string' || typeof children === 'number' ? String(children) : undefined);
  const badgeStyle = maxWidth !== undefined ? ({ maxWidth: toCssSize(maxWidth) } as CSSProperties) : undefined;
  const textStyle =
    shift > 0
      ? ({ '--badge-shift': `${shift}px`, '--badge-speed': `${Math.max(2, Math.round(shift / 40))}s` } as CSSProperties)
      : undefined;

  return (
    <span className={`${styles.badge} ${styles[tone]} ${className ?? ''}`} style={badgeStyle} title={tooltip}>
      {icon ? <Icon name={icon} size={13} /> : null}
      <span ref={wrapRef} className={styles.textWrap}>
        <span ref={textRef} className={styles.text} data-scroll={shift > 0 || undefined} style={textStyle}>
          {children}
        </span>
      </span>
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
  /** Максимальная ширина бейджа (число — px). */
  maxWidth?: number | string;
}

export function StatusBadge<V extends string>({
  value,
  options,
  onChange,
  className,
  maxWidth,
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
      <Badge tone={current.tone} icon={current.icon} maxWidth={maxWidth}>
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
