// Middleware авторизации. Токен принимается из httpOnly-cookie или заголовка Authorization.
import type { NextFunction, Request, Response } from 'express';
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

export async function requireAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const token = extractToken(req);
  const session = token ? await verifySession(token) : null;
  if (!session) throw httpError(401, 'Требуется авторизация', 'UNAUTHORIZED');

  const user = await prisma.users.findUnique({ where: { id: session.id } });
  if (!user || user.deleted_at) throw httpError(401, 'Пользователь не найден', 'UNAUTHORIZED');

  req.user = { id: user.id, email: user.email, role: user.role };
  next();
}
