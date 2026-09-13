// Общие типы API-ответов (даты приходят строками ISO).
import type { RoleType } from '@arbuz/shared';

/** Краткая карточка пользователя (владелец заявки, эксперт, автор). */
export interface UserBrief {
  id: number;
  email: string;
  name: string | null;
  surname: string | null;
  patronymic: string | null;
}

export interface AuthUser extends UserBrief {
  role: RoleType;
}

export interface UserListItem extends AuthUser {
  lastActivity: string;
  createdAt: string;
}
