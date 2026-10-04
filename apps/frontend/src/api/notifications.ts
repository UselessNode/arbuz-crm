// API центра уведомлений (долгие уведомления текущего пользователя).
import type { NotificationType } from '../lib/notification-types';
import { api } from './client';

export interface NotificationItem {
  id: number;
  type: NotificationType;
  title: string;
  /** Исходный Markdown (может быть null). */
  body: string | null;
  /** Безопасный HTML, собранный на сервере (может быть null). */
  bodyHtml: string | null;
  /** Внутренний маршрут для перехода из уведомления. */
  link: string | null;
  isRead: boolean;
  createdAt: string;
  readAt: string | null;
}

export interface NotificationListParams {
  type?: NotificationType;
  limit?: number;
  offset?: number;
}

export interface NotificationListResult {
  notifications: NotificationItem[];
  total: number;
  /** Всего непрочитанных (независимо от фильтра). */
  unread: number;
}

export const notificationsApi = {
  list(params?: NotificationListParams) {
    const query = new URLSearchParams();
    if (params?.type) query.set('type', params.type);
    if (params?.limit !== undefined) query.set('limit', String(params.limit));
    if (params?.offset !== undefined) query.set('offset', String(params.offset));
    const suffix = query.toString() ? `?${query.toString()}` : '';
    return api.get<NotificationListResult>(`/notifications${suffix}`);
  },
  /** Лёгкий запрос для поллинга бейджа непрочитанных. */
  unreadCount() {
    return api.get<{ count: number }>('/notifications/unread-count');
  },
  markRead(id: number) {
    return api.patch<{ ok: boolean }>(`/notifications/${id}/read`, {});
  },
  markAllRead() {
    return api.post<{ ok: boolean }>('/notifications/read-all', {});
  },
};
