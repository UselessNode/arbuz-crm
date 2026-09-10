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
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  (async () => {
    const token = extractToken(req);
    const session = token ? await verifySession(token) : null;
    if (!session) throw httpError(401, 'Требуется авторизация', 'UNAUTHORIZED');

    const user = await prisma.users.findUnique({ where: { id: session.id } });
    if (!user || user.deleted_at) throw httpError(401, 'Пользователь не найден', 'UNAUTHORIZED');

    req.user = { id: user.id, email: user.email, role: user.role };
    next();
  })().catch(next);
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
