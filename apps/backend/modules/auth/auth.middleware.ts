// Middleware авторизации: requireAuth (аутентификация) и requireRole (авторизация по ролям).
// Токен принимается из httpOnly-cookie или заголовка Authorization.
import { RoleType } from '@arbuz/shared';
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { prisma } from '../../lib/prisma';
import { config } from '../../lib/config';
import { httpError } from '../../lib/http';
import { verifySession } from './auth.service';

export function getCookie(req: Request, name: string): string | undefined {
  const header = req.headers.cookie;
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    const key = part.slice(0, eq).trim();
    if (key === name) return decodeURIComponent(part.slice(eq + 1).trim());
  }
  return undefined;
}

export function extractToken(req: Request): string | undefined {
  const authorization = req.headers.authorization;
  if (authorization?.startsWith('Bearer ')) return authorization.slice('Bearer '.length).trim();
  return getCookie(req, config.jwt.cookieName);
}

/**
 * Аутентификация: проверяет токен и подставляет req.user.
 * Express 4 не ловит rejected promise у async-мидлвара, поэтому ошибки явно
 * передаём в next(err), чтобы их обработал errorHandler.
 * По умолчанию требует активированный аккаунт (см. `requireAuthAllowInactive`).
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  (async () => {
    const user = await loadSessionUser(req);
    if (!user) throw httpError(401, 'Требуется авторизация', 'UNAUTHORIZED');
    if (!user.activated_at) {
      throw httpError(403, 'Аккаунт не активирован — завершите регистрацию', 'ACCOUNT_NOT_ACTIVATED');
    }
    req.user = { id: user.id, email: user.email, role: user.role };
    next();
  })().catch(next);
}

/**
 * Аутентификация без требования активации: для `/auth/me` и `/auth/activate`,
 * чтобы неактивный пользователь мог завершить активацию.
 */
export function requireAuthAllowInactive(req: Request, _res: Response, next: NextFunction): void {
  (async () => {
    const user = await loadSessionUser(req);
    if (!user) throw httpError(401, 'Требуется авторизация', 'UNAUTHORIZED');
    req.user = { id: user.id, email: user.email, role: user.role };
    next();
  })().catch(next);
}

/** Загружает пользователя по сессионному токену (или null). */
async function loadSessionUser(
  req: Request,
): Promise<{ id: number; email: string; role: RoleType; activated_at: Date | null } | null> {
  const token = extractToken(req);
  const session = token ? await verifySession(token) : null;
  if (!session) return null;
  const user = await prisma.users.findUnique({
    where: { id: session.id },
    select: { id: true, email: true, role: true, deleted_at: true, activated_at: true },
  });
  if (!user || user.deleted_at) return null;
  return user;
}

/**
 * Необязательная аутентификация: если токен валиден — подставляет req.user,
 * иначе пропускает запрос как гостя (для публичных страниц/ленты).
 */
export function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
  (async () => {
    const token = extractToken(req);
    const session = token ? await verifySession(token) : null;
    if (session) {
      const user = await prisma.users.findUnique({ where: { id: session.id } });
      if (user && !user.deleted_at) {
        req.user = { id: user.id, email: user.email, role: user.role };
      }
    }
  })().then(() => next()).catch(next);
}

/** Авторизация: пускает только перечисленные роли. Использовать после requireAuth. */
export function requireRole(...roles: RoleType[]): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      next(httpError(401, 'Требуется авторизация', 'UNAUTHORIZED'));
      return;
    }
    if (!roles.includes(req.user.role)) {
      next(httpError(403, 'Недостаточно прав для этого действия', 'FORBIDDEN'));
      return;
    }
    next();
  };
}
