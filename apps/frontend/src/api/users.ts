import type { RoleType } from '@arbuz/shared';
import { api } from './client';
import type { UserListItem } from './types';

export interface UserListParams {
  role?: RoleType;
  limit: number;
  offset: number;
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

export interface ExpertItem {
  id: number;
  email: string;
  name: string | null;
  surname: string | null;
  patronymic: string | null;
}

export const usersApi = {
  list(params: UserListParams) {
    const query = new URLSearchParams({ limit: String(params.limit), offset: String(params.offset) });
    if (params.role) query.set('role', params.role);
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
  remove(id: number) {
    return api.delete<{ ok: boolean }>(`/users/${id}`);
  },
  listExperts() {
    return api.get<{ experts: ExpertItem[] }>('/users/experts');
  },
};
