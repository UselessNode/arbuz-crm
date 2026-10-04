// Переключатель фильтра уведомлений по типу (общий для колокольчика и страницы).
import { Icon } from '../components/ui';
import { NOTIFICATION_TYPES, NOTIFICATION_TYPE_META, type NotificationType } from '../lib/notification-types';
import styles from './NotificationFilters.module.css';

export type NotificationFilter = NotificationType | 'all';

const OPTIONS: readonly { value: NotificationFilter; label: string; icon: string }[] = [
  { value: 'all', label: 'Все', icon: 'bell' },
  ...NOTIFICATION_TYPES.map((type) => ({
    value: type as NotificationFilter,
    label: NOTIFICATION_TYPE_META[type].label,
    icon: NOTIFICATION_TYPE_META[type].icon,
  })),
];

export function NotificationFilters({
  value,
  onChange,
}: {
  value: NotificationFilter;
  onChange: (value: NotificationFilter) => void;
}) {
  return (
    <div className={styles.filters} role="tablist" aria-label="Фильтр по типу">
      {OPTIONS.map((option) => (
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
