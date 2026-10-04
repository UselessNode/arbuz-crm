import type { RoleType } from '@arbuz/shared';
import { api } from './client';
import type { NotificationItem } from './notifications';
import type { UserBrief, UserListItem } from './types';

export interface UserListParams {
  role?: RoleType;
  /** Поиск по ФИО и email. */
  search?: string;
  limit: number;
  offset: number;
  /** Диапазон даты создания аккаунта (yyyy-mm-dd). */
  createdFrom?: string;
  createdTo?: string;
  /** Диапазон последней активности (yyyy-mm-dd). */
  activityFrom?: string;
  activityTo?: string;
  /** Диапазон числа заявок пользователя. */
  appsMin?: number;
  appsMax?: number;
}

export interface UserPayload {
  email: string;
  password: string;
  role: RoleType;
  surname?: string | null;
  name?: string | null;
  patronymic?: string | null;
}

export interface UserPatch {
  email?: string;
  role?: RoleType;
  surname?: string | null;
  name?: string | null;
  patronymic?: string | null;
}

/** Эксперт для селекта назначения (без служебных полей). */
export type ExpertItem = UserBrief;

export const usersApi = {
  list(params: UserListParams) {
    const query = new URLSearchParams({ limit: String(params.limit), offset: String(params.offset) });
    if (params.role) query.set('role', params.role);
    if (params.search) query.set('q', params.search);
    if (params.createdFrom) query.set('created_from', params.createdFrom);
    if (params.createdTo) query.set('created_to', params.createdTo);
    if (params.activityFrom) query.set('active_from', params.activityFrom);
    if (params.activityTo) query.set('active_to', params.activityTo);
    if (params.appsMin !== undefined) query.set('apps_min', String(params.appsMin));
    if (params.appsMax !== undefined) query.set('apps_max', String(params.appsMax));
    return api.get<{ users: UserListItem[]; total: number }>(`/users?${query.toString()}`);
  },
  create(payload: UserPayload) {
    return api.post<{ user: UserListItem }>('/users', payload);
  },
  update(id: number, patch: UserPatch) {
    return api.patch<{ user: UserListItem }>(`/users/${id}`, patch);
  },
  resetPassword(id: number, password: string) {
    return api.post<{ ok: boolean }>(`/users/${id}/reset-password`, { password });
  },
  /** Целевое уведомление (Markdown-текст) конкретному пользователю. */
  notify(id: number, payload: { title: string; body?: string | null }) {
    return api.post<{ notification: NotificationItem }>(`/users/${id}/notify`, payload);
  },
  remove(id: number) {
    return api.delete<{ ok: boolean }>(`/users/${id}`);
  },
  listExperts() {
    return api.get<{ experts: ExpertItem[] }>('/users/experts');
  },
};
