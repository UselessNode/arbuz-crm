// HTTP API управления пользователями. Все маршруты — только администратор.
import { RoleType } from '@arbuz/shared';
import { Router } from 'express';
import type { Request, Response } from 'express';
import { asyncHandler, httpError } from '../../lib/http';
import { log } from '../../lib/logger';
import { parseLimitOffset, parseSearch } from '../../lib/query';
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

export const usersRouter = Router();
usersRouter.use(requireAuth, requireRole(RoleType.admin));

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
    const roleRaw = req.query.role;
    const role =
      roleRaw !== undefined && [RoleType.admin, RoleType.expert, RoleType.applicant].includes(roleRaw as RoleType)
        ? (roleRaw as RoleType)
        : undefined;
    const result = await listUsers({ role, search, limit, offset });
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
