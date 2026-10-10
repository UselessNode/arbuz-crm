// HTTP API управления пользователями. Все маршруты — только администратор.
import { RoleType } from '@arbuz/shared';
import { Router } from 'express';
import type { Request, Response } from 'express';
import { asyncHandler, httpError } from '../../lib/http';
import { log } from '../../lib/logger';
import {
  parseBoolParam,
  parseDateRange,
  parseEnumArray,
  parseLimitOffset,
  parseNumberRange,
  parseSearch,
  parseSort,
} from '../../lib/query';
import { requireAuth, requireRole } from '../auth/auth.middleware';
import type { CurrentUser } from '../files/files.service';
import {
  createUser,
  deleteUser,
  getUserOrThrow,
  listExperts,
  listUsers,
  resetPassword,
  updateUser,
} from './users.service';
import { sendAdminMessage } from '../notifications/notifications.service';

export const usersRouter = Router();
usersRouter.use(requireAuth, requireRole(RoleType.admin));

const ROLE_VALUES: readonly RoleType[] = [RoleType.admin, RoleType.expert, RoleType.applicant];
const USERS_SORT_FIELDS = ['id', 'email', 'name', 'role', 'created_at', 'last_activity', 'activated_at', 'applications'] as const;

function parseId(raw: string | undefined): number {
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) {
    throw httpError(400, 'Некорректный идентификатор', 'INVALID_ID');
  }
  return value;
}

usersRouter.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const { limit, offset } = parseLimitOffset(req.query);
    const search = parseSearch(req.query);
    // Мультивыбор ролей; одиночный `role` — для обратной совместимости.
    const roles = parseEnumArray(req.query.roles, ROLE_VALUES) ?? parseEnumArray(req.query.role, ROLE_VALUES);
    const result = await listUsers({
      roles,
      search,
      activated: parseBoolParam(req.query.activated),
      created: parseDateRange(req.query, 'created'),
      activity: parseDateRange(req.query, 'active'),
      apps: parseNumberRange(req.query, 'apps'),
      sort: parseSort(req.query, USERS_SORT_FIELDS),
      limit,
      offset,
    });
    res.json(result);
  }),
);

usersRouter.post(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const actor = req.user as CurrentUser;
    const user = await createUser(actor.id, {
      email: req.body?.email,
      password: req.body?.password,
      role: req.body?.role,
      surname: req.body?.surname,
      name: req.body?.name,
      patronymic: req.body?.patronymic,
      region_id: req.body?.region_id,
    });
    log.audit('users.create', { actorId: actor.id, userId: user.id, role: user.role });
    res.status(201).json({ user });
  }),
);

usersRouter.get(
  '/experts',
  asyncHandler(async (_req: Request, res: Response) => {
    const experts = await listExperts();
    res.json({ experts });
  }),
);

usersRouter.get(
  '/:userId',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = parseId(req.params.userId);
    const user = await getUserOrThrow(userId);
    res.json({ user });
  }),
);

usersRouter.patch(
  '/:userId',
  asyncHandler(async (req: Request, res: Response) => {
    const actor = req.user as CurrentUser;
    const userId = parseId(req.params.userId);
    const user = await updateUser(actor.id, userId, {
      email: req.body?.email,
      role: req.body?.role,
      surname: req.body?.surname,
      name: req.body?.name,
      patronymic: req.body?.patronymic,
      region_id: req.body?.region_id,
    });
    log.audit('users.update', { actorId: actor.id, userId: user.id, role: user.role });
    res.json({ user });
  }),
);

usersRouter.post(
  '/:userId/reset-password',
  asyncHandler(async (req: Request, res: Response) => {
    const actor = req.user as CurrentUser;
    const userId = parseId(req.params.userId);
    await resetPassword(actor.id, userId, req.body?.password);
    log.audit('users.reset_password', { actorId: actor.id, userId });
    res.json({ ok: true });
  }),
);

usersRouter.post(
  '/:userId/notify',
  asyncHandler(async (req: Request, res: Response) => {
    const actor = req.user as CurrentUser;
    const userId = parseId(req.params.userId);
    const notification = await sendAdminMessage(actor, userId, {
      title: req.body?.title,
      body: req.body?.body,
    });
    log.audit('users.notify', { actorId: actor.id, userId, notificationId: notification.id });
    res.status(201).json({ notification });
  }),
);

usersRouter.delete(
  '/:userId',
  asyncHandler(async (req: Request, res: Response) => {
    const actor = req.user as CurrentUser;
    const userId = parseId(req.params.userId);
    await deleteUser(actor.id, userId);
    log.audit('users.delete', { actorId: actor.id, userId });
    res.json({ ok: true });
  }),
);
