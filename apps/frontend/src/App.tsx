// Корень приложения: шапка со статусом бэкенда и страница дизайн-системы.
import { useEffect, useState } from 'react';
import { StatusBadge } from './components/ui';
import type { StatusOption } from './components/ui';
import { DesignSystemPage } from './pages/DesignSystemPage/DesignSystemPage';
import melonLogo from './assets/images/Melon.png';
import styles from './App.module.css';

type Health = { status: string; database: string };
type BackendState = 'ok' | 'degraded' | 'unreachable';

const BACKEND_OPTIONS: readonly StatusOption<BackendState>[] = [
  { value: 'ok', label: 'Бэкенд: подключён', tone: 'green' },
  { value: 'degraded', label: 'Бэкенд: БД недоступна', tone: 'yellow' },
  { value: 'unreachable', label: 'Бэкенд: недоступен', tone: 'red' },
];

export function App() {
  const [backend, setBackend] = useState<BackendState>('unreachable');

  useEffect(() => {
    fetch('/health')
      .then((response) => response.json())
      .then((data: Health) => setBackend(data.status === 'ok' ? 'ok' : 'degraded'))
      .catch(() => setBackend('unreachable'));
  }, []);

  return (
    <div>
      <header className={styles.header}>
        <div className={styles.brand}>
          <img src={melonLogo} alt="Логотип Arbuz CRM" className={styles.logo} />
          <span className={styles.title}>Arbuz CRM</span>
          <span className={styles.subtitle}>Дизайн-система — тестовая страница</span>
        </div>
        <StatusBadge value={backend} options={BACKEND_OPTIONS} />
      </header>
      <DesignSystemPage />
    </div>
  );
}
