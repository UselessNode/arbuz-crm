// Общие типы API-ответов (даты приходят строками ISO).
import type { RoleType } from '@arbuz/shared';

export interface AuthUser {
  id: number;
  email: string;
  role: RoleType;
  surname: string | null;
  name: string | null;
  patronymic: string | null;
}

export interface UserListItem extends AuthUser {
  lastActivity: string;
  createdAt: string;
}
