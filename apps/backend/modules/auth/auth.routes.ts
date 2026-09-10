// Маршруты аутентификации: вход, выход, текущий пользователь.
import { Router } from 'express';
import { prisma } from '../../lib/prisma';
import { config } from '../../lib/config';
import { httpError, asyncHandler } from '../../lib/http';
import { log } from '../../lib/logger';
import type { PublicUser } from './auth.service';
import { signSession, verifyPassword, registerApplicant } from './auth.service';
import { requireAuth } from './auth.middleware';

export const authRouter = Router();

function toPublicUser(user: {
  id: number;
  email: string;
  role: PublicUser['role'];
  surname: string | null;
  name: string | null;
  patronymic: string | null;
}): PublicUser {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    surname: user.surname,
    name: user.name,
    patronymic: user.patronymic,
  };
}

function setSessionCookie(res: import('express').Response, token: string): void {
  res.cookie(config.jwt.cookieName, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.isProduction,
    maxAge: 12 * 60 * 60 * 1000, // 12 часов, как и срок JWT
    path: '/',
  });
}

authRouter.post(
  '/login',
  asyncHandler(async (req, res) => {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    if (!email || !password) throw httpError(400, 'Укажите email и пароль', 'INVALID_BODY');

    const user = await prisma.users.findUnique({ where: { email } });
    if (!user || user.deleted_at || !(await verifyPassword(password, user.password_hash))) {
      log.audit('auth.login_failed', { email });
      throw httpError(401, 'Неверный email или пароль', 'INVALID_CREDENTIALS');
    }

    const token = await signSession({ id: user.id, role: user.role });
    await prisma.users.update({
      where: { id: user.id },
      data: { last_activity: new Date() },
    });
    setSessionCookie(res, token);
    log.audit('auth.login', { userId: user.id, email: user.email, role: user.role });
    res.json({ user: toPublicUser(user) });
  }),
);

authRouter.post(
  '/register',
  asyncHandler(async (req, res) => {
    const user = await registerApplicant({
      email: req.body?.email,
      password: req.body?.password,
      surname: req.body?.surname,
      name: req.body?.name,
      patronymic: req.body?.patronymic,
    });
    const token = await signSession({ id: user.id, role: user.role });
    setSessionCookie(res, token);
    log.audit('auth.register', { userId: user.id, email: user.email });
    res.status(201).json({ user: toPublicUser(user) });
  }),
);

authRouter.post('/logout', (req, res) => {
  const userId = req.user?.id;
  res.clearCookie(config.jwt.cookieName, { path: '/' });
  log.audit('auth.logout', userId ? { userId } : {});
  res.json({ ok: true });
});

authRouter.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await prisma.users.findUnique({ where: { id: req.user!.id } });
    if (!user || user.deleted_at) throw httpError(401, 'Пользователь не найден', 'UNAUTHORIZED');
    res.json({ user: toPublicUser(user) });
  }),
);
