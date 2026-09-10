// Состояния данных: загрузка / пусто / ошибка (единый вид для всех списков).
import { Button } from '../Button';
import { Icon } from '../Icon';
import styles from './Feedback.module.css';

export interface StateMessageProps {
  state: 'loading' | 'empty' | 'error';
  message?: string;
  onRetry?: () => void;
}

export function StateMessage({ state, message, onRetry }: StateMessageProps) {
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
      <Icon name="folder" size={22} />
      <span>{message ?? 'Нет данных'}</span>
    </div>
  );
}
