import { api } from './client';
import type { AuthUser } from './types';

export interface RegisterPayload {
  email: string;
  password: string;
  surname?: string | null;
  name?: string | null;
  patronymic?: string | null;
  /** Обязательное принятие пользовательского соглашения. */
  accept_terms: boolean;
  /** Обязательное согласие на обработку персональных данных. */
  accept_personal_data_consent: boolean;
}

export interface ActivatePayload {
  surname?: string | null;
  name?: string | null;
  patronymic?: string | null;
  /** Необязательная смена пароля. */
  password?: string;
  accept_terms: boolean;
  accept_personal_data_consent: boolean;
}

export const authApi = {
  login: (email: string, password: string) => api.post<{ user: AuthUser }>('/auth/login', { email, password }),
  register: (payload: RegisterPayload) => api.post<{ user: AuthUser }>('/auth/register', payload),
  activate: (payload: ActivatePayload) => api.post<{ user: AuthUser }>('/auth/activate', payload),
  logout: () => api.post<{ ok: boolean }>('/auth/logout'),
  me: () => api.get<{ user: AuthUser }>('/auth/me'),
};
