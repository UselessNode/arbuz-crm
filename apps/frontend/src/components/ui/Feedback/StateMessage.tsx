// Состояния данных: загрузка / пусто / ошибка (единый вид для всех списков).
import { Button } from '../Button';
import { Icon, type IconName } from '../Icon';
import styles from './Feedback.module.css';

/** Иконка пустого состояния по контексту: `empty-set` — список, `inbox` — уведомления, `box` — справочники. */
export type StateMessageEmptyIcon = 'empty-set' | 'inbox' | 'box';

export interface StateMessageProps {
  state: 'loading' | 'empty' | 'error';
  message?: string;
  onRetry?: () => void;
  /** Иконка для `state="empty"` (по умолчанию `empty-set`). */
  icon?: StateMessageEmptyIcon;
}

const EMPTY_ICONS = {
  'empty-set': 'empty-set',
  inbox: 'inbox',
  box: 'box',
} as const satisfies Record<StateMessageEmptyIcon, IconName>;

export function StateMessage({ state, message, onRetry, icon = 'empty-set' }: StateMessageProps) {
  if (state === 'loading') {
    return (
      <div className={styles.state}>
        <span className={styles.spinner} />
        <span>{message ?? 'Загрузка…'}</span>
      </div>
    );
  }

  if (state === 'error') {
    return (
      <div className={`${styles.state} ${styles.error}`}>
        <Icon name="error" size={22} />
        <span>{message ?? 'Не удалось загрузить данные'}</span>
        {onRetry ? (
          <Button variant="secondary" size="sm" icon="loading" onClick={onRetry}>
            Повторить
          </Button>
        ) : null}
      </div>
    );
  }

  return (
    <div className={styles.state}>
      <Icon name={EMPTY_ICONS[icon]} size={22} />
      <span>{message ?? 'Нет данных'}</span>
    </div>
  );
}
