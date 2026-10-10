// Контекст центра уведомлений: счётчик непрочитанных (поллинг) и пометка прочитанным.
//
// Полный список уведомлений грузит панель-колокольчик по требованию (при открытии),
// а провайдер держит только лёгкий счётчик, чтобы бейдж в шапке был актуален.
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { notificationsApi } from '../api/notifications';
import type { NotificationType } from '../lib/notification-types';
import { useAuth } from '../auth/AuthContext';

/** Период опроса счётчика непрочитанных (мс). Нагрузка мала (≤50 пользователей). */
const UNREAD_POLL_MS = 60_000;

interface NotificationsContextValue {
  /** Количество непрочитанных уведомлений. */
  unread: number;
  /** Принудительно перечитать счётчик. */
  refreshUnread: () => Promise<void>;
  /** Пометить одно уведомление прочитанным (счётчик уменьшается сразу). */
  markRead: (id: number) => Promise<void>;
  /** Пометить прочитанными: без типа — все; с типом — только выбранную категорию. */
  markAllRead: (type?: NotificationType) => Promise<void>;
}

const NotificationsContext = createContext<NotificationsContextValue | null>(null);

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [unread, setUnread] = useState(0);

  const refreshUnread = useCallback(async () => {
    if (!user) {
      setUnread(0);
      return;
    }
    try {
      const response = await notificationsApi.unreadCount();
      setUnread(response.count);
    } catch {
      /* тихо: счётчик — не критичный элемент, следующий опрос попробует снова */
    }
  }, [user]);

  // Опрос счётчика, пока пользователь авторизован. Обновляем при возврате на вкладку.
  useEffect(() => {
    if (!user) {
      setUnread(0);
      return undefined;
    }
    void refreshUnread();
    const timer = window.setInterval(() => void refreshUnread(), UNREAD_POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refreshUnread();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [user, refreshUnread]);

  const markRead = useCallback(async (id: number) => {
    await notificationsApi.markRead(id);
    setUnread((prev) => Math.max(0, prev - 1));
  }, []);

  const markAllRead = useCallback(async (type?: NotificationType) => {
    await notificationsApi.markAllRead(type);
    // Частичная пометка (по категории) — пересчитываем счётчик с сервера,
    // а не обнуляем: остальные категории могли остаться непрочитанными.
    await refreshUnread();
  }, [refreshUnread]);

  const value = useMemo<NotificationsContextValue>(
    () => ({ unread, refreshUnread, markRead, markAllRead }),
    [unread, refreshUnread, markRead, markAllRead],
  );

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

export function useNotifications(): NotificationsContextValue {
  const context = useContext(NotificationsContext);
  if (!context) throw new Error('useNotifications должен использоваться внутри NotificationsProvider');
  return context;
}
