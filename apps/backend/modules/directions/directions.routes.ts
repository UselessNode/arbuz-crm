// HTTP API направлений заявок. Только администратор.
import { RoleType } from '@arbuz/shared';
import { Router } from 'express';
import type { Request, Response } from 'express';
import { asyncHandler } from '../../lib/http';
import { log } from '../../lib/logger';
import { requireAuth, requireRole } from '../auth/auth.middleware';
import type { CurrentUser } from '../files/files.service';
import {
  createDirection,
  deleteDirection,
  getDirectionOrThrow,
  listDirections,
  parseId,
  updateDirection,
} from './directions.service';

export const directionsRouter = Router();
directionsRouter.use(requireAuth, requireRole(RoleType.admin));

directionsRouter.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const tenderId = req.query.tenderId !== undefined ? parseId(String(req.query.tenderId)) : undefined;
    const directions = await listDirections(tenderId);
    res.json({ directions });
  }),
);

directionsRouter.post(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const direction = await createDirection({
      name: req.body?.name,
      description: req.body?.description,
      tender_id: req.body?.tender_id,
    });
    log.audit('directions.create', { userId: (req.user as CurrentUser).id, directionId: direction.id });
    res.status(201).json({ direction });
  }),
);

directionsRouter.get(
  '/:directionId',
  asyncHandler(async (req: Request, res: Response) => {
    const direction = await getDirectionOrThrow(parseId(req.params.directionId));
    res.json({ direction });
  }),
);

directionsRouter.patch(
  '/:directionId',
  asyncHandler(async (req: Request, res: Response) => {
    const direction = await updateDirection(parseId(req.params.directionId), {
      name: req.body?.name,
      description: req.body?.description,
      tender_id: req.body?.tender_id,
    });
    res.json({ direction });
  }),
);

directionsRouter.delete(
  '/:directionId',
  asyncHandler(async (req: Request, res: Response) => {
    const directionId = parseId(req.params.directionId);
    await deleteDirection(directionId);
    log.audit('directions.delete', { userId: (req.user as CurrentUser).id, directionId });
    res.json({ ok: true });
  }),
);
