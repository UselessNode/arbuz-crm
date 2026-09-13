// HTTP API справочника вердиктов рецензий.
// Чтение — всем авторизованным (нужно эксперту и списку рецензий), изменения — администратору.
import { RoleType } from '@arbuz/shared';
import { Router } from 'express';
import type { Request, Response } from 'express';
import { asyncHandler } from '../../lib/http';
import { log } from '../../lib/logger';
import { parseId } from '../../lib/parse';
import { requireAuth, requireRole } from '../auth/auth.middleware';
import type { CurrentUser } from '../files/files.service';
import {
  createReviewStatus,
  deleteReviewStatus,
  getReviewStatusOrThrow,
  listReviewStatuses,
  updateReviewStatus,
} from './review-statuses.service';

export const reviewStatusesRouter = Router();
reviewStatusesRouter.use(requireAuth);

reviewStatusesRouter.get(
  '/',
  asyncHandler(async (_req: Request, res: Response) => {
    const statuses = await listReviewStatuses();
    res.json({ statuses });
  }),
);

reviewStatusesRouter.post(
  '/',
  requireRole(RoleType.admin),
  asyncHandler(async (req: Request, res: Response) => {
    const status = await createReviewStatus({
      name: req.body?.name,
      description: req.body?.description,
      tone: req.body?.tone,
      is_default: req.body?.is_default,
    });
    log.audit('review_statuses.create', { userId: (req.user as CurrentUser).id, statusId: status.id });
    res.status(201).json({ status });
  }),
);

reviewStatusesRouter.patch(
  '/:statusId',
  requireRole(RoleType.admin),
  asyncHandler(async (req: Request, res: Response) => {
    const status = await updateReviewStatus(parseId(req.params.statusId), {
      name: req.body?.name,
      description: req.body?.description,
      tone: req.body?.tone,
      is_default: req.body?.is_default,
    });
    res.json({ status });
  }),
);

reviewStatusesRouter.delete(
  '/:statusId',
  requireRole(RoleType.admin),
  asyncHandler(async (req: Request, res: Response) => {
    const statusId = parseId(req.params.statusId);
    await deleteReviewStatus(statusId);
    log.audit('review_statuses.delete', { userId: (req.user as CurrentUser).id, statusId });
    res.json({ ok: true });
  }),
);

reviewStatusesRouter.get(
  '/:statusId',
  asyncHandler(async (req: Request, res: Response) => {
    const status = await getReviewStatusOrThrow(parseId(req.params.statusId));
    res.json({ status });
  }),
);
