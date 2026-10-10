// HTTP API справочника регионов. Чтение — всем авторизованным, изменения — администратору.
import { RoleType } from '@arbuz/shared';
import { Router } from 'express';
import type { Request, Response } from 'express';
import { asyncHandler } from '../../lib/http';
import { log } from '../../lib/logger';
import { requireAuth, requireRole } from '../auth/auth.middleware';
import { parseId } from '../directions/directions.service';
import type { CurrentUser } from '../files/files.service';
import { createRegion, deleteRegion, getRegionOrThrow, listRegions, updateRegion } from './regions.service';

export const regionsRouter = Router();
regionsRouter.use(requireAuth);

regionsRouter.get(
  '/',
  asyncHandler(async (_req: Request, res: Response) => {
    const regions = await listRegions();
    res.json({ regions });
  }),
);

regionsRouter.post(
  '/',
  requireRole(RoleType.admin),
  asyncHandler(async (req: Request, res: Response) => {
    const region = await createRegion({
      name: req.body?.name,
      is_default: req.body?.is_default,
      sort_order: req.body?.sort_order,
    });
    log.audit('regions.create', { userId: (req.user as CurrentUser).id, regionId: region.id });
    res.status(201).json({ region });
  }),
);

regionsRouter.get(
  '/:regionId',
  asyncHandler(async (req: Request, res: Response) => {
    const region = await getRegionOrThrow(parseId(req.params.regionId));
    res.json({ region });
  }),
);

regionsRouter.patch(
  '/:regionId',
  requireRole(RoleType.admin),
  asyncHandler(async (req: Request, res: Response) => {
    const region = await updateRegion(parseId(req.params.regionId), {
      name: req.body?.name,
      is_default: req.body?.is_default,
      sort_order: req.body?.sort_order,
    });
    res.json({ region });
  }),
);

regionsRouter.delete(
  '/:regionId',
  requireRole(RoleType.admin),
  asyncHandler(async (req: Request, res: Response) => {
    const regionId = parseId(req.params.regionId);
    await deleteRegion(regionId);
    log.audit('regions.delete', { userId: (req.user as CurrentUser).id, regionId });
    res.json({ ok: true });
  }),
);
