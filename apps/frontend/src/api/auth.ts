import { api } from './client';
import type { AuthUser } from './types';

export interface RegisterPayload {
  email: string;
  password: string;
  surname?: string | null;
  name?: string | null;
  patronymic?: string | null;
}

export const authApi = {
  login: (email: string, password: string) => api.post<{ user: AuthUser }>('/auth/login', { email, password }),
  register: (payload: RegisterPayload) => api.post<{ user: AuthUser }>('/auth/register', payload),
  logout: () => api.post<{ ok: boolean }>('/auth/logout'),
  me: () => api.get<{ user: AuthUser }>('/auth/me'),
};
