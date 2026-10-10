// Маршруты аутентификации: вход, выход, текущий пользователь.
import { Router } from 'express';
import { prisma } from '../../lib/prisma';
import { config } from '../../lib/config';
import { httpError, asyncHandler } from '../../lib/http';
import { log } from '../../lib/logger';
import type { PublicUser } from './auth.service';
import { signSession, verifyPassword, registerApplicant, activateAccount } from './auth.service';
import { requireAuthAllowInactive } from './auth.middleware';
import type { CurrentUser } from '../files/files.service';

export const authRouter = Router();

function toPublicUser(user: {
  id: number;
  email: string;
  role: PublicUser['role'];
  surname: string | null;
  name: string | null;
  patronymic: string | null;
  region_id: number | null;
  region?: { name: string } | null;
  activated_at: Date | null;
}): PublicUser {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    surname: user.surname,
    name: user.name,
    patronymic: user.patronymic,
    regionId: user.region_id,
    regionName: user.region?.name ?? null,
    activatedAt: user.activated_at,
  };
}

function setSessionCookie(res: import('express').Response, token: string): void {
  res.cookie(config.jwt.cookieName, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.isProduction,
    maxAge: config.jwt.cookieMaxAgeMs, // совпадает со сроком жизни JWT (config.jwt.expiresIn)
    path: '/',
  });
}

authRouter.post(
  '/login',
  asyncHandler(async (req, res) => {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    if (!email || !password) throw httpError(400, 'Укажите email и пароль', 'INVALID_BODY');

    const user = await prisma.users.findUnique({ where: { email }, include: { region: { select: { name: true } } } });
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
    const user = await registerApplicant(
      {
        email: req.body?.email,
        password: req.body?.password,
        surname: req.body?.surname,
        name: req.body?.name,
        patronymic: req.body?.patronymic,
        region_id: req.body?.region_id,
        accept_terms: req.body?.accept_terms,
        accept_personal_data_consent: req.body?.accept_personal_data_consent,
      },
      {
        // IP и User-Agent сохраняются в журнале согласий как доказательство.
        ip: req.ip ?? null,
        userAgent: req.get('user-agent') ?? null,
      },
    );
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
  requireAuthAllowInactive,
  asyncHandler(async (req, res) => {
    const user = await prisma.users.findUnique({ where: { id: req.user!.id }, include: { region: { select: { name: true } } } });
    if (!user || user.deleted_at) throw httpError(401, 'Пользователь не найден', 'UNAUTHORIZED');
    res.json({ user: toPublicUser(user) });
  }),
);

// Завершение активации аккаунта, созданного администратором: правка данных,
// (опционально) смена пароля и обязательное принятие ПС/ПДн.
authRouter.post(
  '/activate',
  requireAuthAllowInactive,
  asyncHandler(async (req, res) => {
    const actor = req.user as CurrentUser;
    const user = await activateAccount(
      actor.id,
      {
        surname: req.body?.surname,
        name: req.body?.name,
        patronymic: req.body?.patronymic,
        region_id: req.body?.region_id,
        password: req.body?.password,
        accept_terms: req.body?.accept_terms,
        accept_personal_data_consent: req.body?.accept_personal_data_consent,
      },
      { ip: req.ip ?? null, userAgent: req.get('user-agent') ?? null },
    );
    log.audit('auth.activate', { userId: user.id, email: user.email });
    res.json({ user: toPublicUser(user) });
  }),
);
