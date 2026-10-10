// Переключатель фильтра уведомлений по типу.
// Используется в двух видах:
//  • horizontal — компактные пилюли (страница /notifications, узкие места);
//  • vertical   — вертикальный список как в сайдбаре (панель колокольчика):
//    иконка + подпись + счётчик, с возможностью свернуть подписи.
import { Icon } from '../components/ui';
import { NOTIFICATION_TYPES, NOTIFICATION_TYPE_META, type NotificationType } from '../lib/notification-types';
import styles from './NotificationFilters.module.css';

export type NotificationFilter = NotificationType | 'all';

interface Option {
  value: NotificationFilter;
  label: string;
  icon: string;
}

const BASE_OPTIONS: readonly Option[] = [
  { value: 'all', label: 'Все', icon: 'bell' },
  ...NOTIFICATION_TYPES.map((type) => ({
    value: type as NotificationFilter,
    label: NOTIFICATION_TYPE_META[type].label,
    icon: NOTIFICATION_TYPE_META[type].icon,
  })),
];

interface Props {
  value: NotificationFilter;
  onChange: (value: NotificationFilter) => void;
  /** Вертикальный список (как сайдбар) вместо строки пилюль. */
  vertical?: boolean;
  /** Количество уведомлений по каждому типу (+ `all`). Показывается кружком. */
  counts?: Record<string, number>;
  /** Свёрнутый вид: скрыть подписи, оставить иконки и счётчики. */
  collapsed?: boolean;
  /** Доступные типы для роли (служебные категории не показываем). */
  types?: readonly NotificationType[];
}

export function NotificationFilters({ value, onChange, vertical = false, counts, collapsed = false, types }: Props) {
  // Оставляем «Все» и только доступные роли типы (порядок — как в справочнике).
  const options = types ? BASE_OPTIONS.filter((o) => o.value === 'all' || types.includes(o.value)) : BASE_OPTIONS;

  if (!vertical) {
    return (
      <div className={styles.filters} role="tablist" aria-label="Фильтр по типу">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={value === option.value}
            className={`${styles.filter} ${value === option.value ? styles.filterActive : ''}`}
            onClick={() => onChange(option.value)}
          >
            <Icon name={option.icon} size={14} />
            {option.label}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className={`${styles.filtersVertical} ${collapsed ? styles.filtersVerticalCollapsed : ''}`} role="tablist" aria-label="Фильтр по типу">
      {options.map((option) => {
        const count = counts?.[option.value] ?? 0;
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={value === option.value}
            title={collapsed ? option.label : undefined}
            className={`${styles.filterVertical} ${value === option.value ? styles.filterVerticalActive : ''}`}
            onClick={() => onChange(option.value)}
          >
            <Icon name={option.icon} size={16} />
            {!collapsed ? <span className={styles.filterVerticalLabel}>{option.label}</span> : null}
            {count > 0 ? <span className={styles.filterVerticalCount}>{count > 99 ? '99+' : count}</span> : null}
          </button>
        );
      })}
    </div>
  );
}
