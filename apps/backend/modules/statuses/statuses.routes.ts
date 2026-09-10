// HTTP API статусов заявок. Только администратор.
import { RoleType } from '@arbuz/shared';
import { Router } from 'express';
import type { Request, Response } from 'express';
import { asyncHandler } from '../../lib/http';
import { log } from '../../lib/logger';
import { requireAuth, requireRole } from '../auth/auth.middleware';
import type { CurrentUser } from '../files/files.service';
import { createStatus, deleteStatus, getStatusOrThrow, listStatuses, parseId, updateStatus } from './statuses.service';

export const statusesRouter = Router();
statusesRouter.use(requireAuth, requireRole(RoleType.admin));

statusesRouter.get(
  '/',
  asyncHandler(async (_req: Request, res: Response) => {
    const statuses = await listStatuses();
    res.json({ statuses });
  }),
);

statusesRouter.post(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const status = await createStatus({
      name: req.body?.name,
      description: req.body?.description,
      is_editable: req.body?.is_editable,
      is_deletable: req.body?.is_deletable,
    });
    log.audit('statuses.create', { userId: (req.user as CurrentUser).id, statusId: status.id });
    res.status(201).json({ status });
  }),
);

statusesRouter.get(
  '/:statusId',
  asyncHandler(async (req: Request, res: Response) => {
    const status = await getStatusOrThrow(parseId(req.params.statusId));
    res.json({ status });
  }),
);

statusesRouter.patch(
  '/:statusId',
  asyncHandler(async (req: Request, res: Response) => {
    const status = await updateStatus(parseId(req.params.statusId), {
      name: req.body?.name,
      description: req.body?.description,
      is_editable: req.body?.is_editable,
      is_deletable: req.body?.is_deletable,
    });
    res.json({ status });
  }),
);

statusesRouter.delete(
  '/:statusId',
  asyncHandler(async (req: Request, res: Response) => {
    const statusId = parseId(req.params.statusId);
    await deleteStatus(statusId);
    log.audit('statuses.delete', { userId: (req.user as CurrentUser).id, statusId });
    res.json({ ok: true });
  }),
);
