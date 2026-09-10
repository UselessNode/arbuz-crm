import { api } from './client';
import type { AuthUser } from './types';

export const authApi = {
  login: (email: string, password: string) => api.post<{ user: AuthUser }>('/auth/login', { email, password }),
  logout: () => api.post<{ ok: boolean }>('/auth/logout'),
  me: () => api.get<{ user: AuthUser }>('/auth/me'),
};
