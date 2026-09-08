// Расширение Express: авторизованный пользователь на Request.
import type { RoleType } from '@arbuz/shared';

declare global {
  namespace Express {
    interface Request {
      user?: { id: number; email: string; role: RoleType };
    }
  }
}

export {};
