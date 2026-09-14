// HTTP API критериев оценивания конкурса. Чтение — авторизованным (эксперт/админ), изменения — админ.
import { RoleType } from '@arbuz/shared';
import { Router } from 'express';
import type { Request, Response } from 'express';
import { asyncHandler } from '../../lib/http';
import { log } from '../../lib/logger';
import { requireAuth, requireRole } from '../auth/auth.middleware';
import type { CurrentUser } from '../files/files.service';
import { createCriterion, deleteCriterion, listCriteria, parseId, updateCriterion } from './criteria.service';

export const criteriaRouter = Router();
criteriaRouter.use(requireAuth);

criteriaRouter.get(
  '/:tenderId/criteria',
  asyncHandler(async (req: Request, res: Response) => {
    const tenderId = parseId(req.params.tenderId);
    const criteria = await listCriteria(tenderId);
    res.json({ criteria });
  }),
);

criteriaRouter.post(
  '/:tenderId/criteria',
  requireRole(RoleType.admin),
  asyncHandler(async (req: Request, res: Response) => {
    const tenderId = parseId(req.params.tenderId);
    const criterion = await createCriterion(tenderId, req.body ?? {});
    log.audit('criteria.create', { userId: (req.user as CurrentUser).id, tenderId, criterionId: criterion.id });
    res.status(201).json({ criterion });
  }),
);

criteriaRouter.patch(
  '/:tenderId/criteria/:criterionId',
  requireRole(RoleType.admin),
  asyncHandler(async (req: Request, res: Response) => {
    const tenderId = parseId(req.params.tenderId);
    const criterionId = parseId(req.params.criterionId);
    const criterion = await updateCriterion(tenderId, criterionId, req.body ?? {});
    res.json({ criterion });
  }),
);

criteriaRouter.delete(
  '/:tenderId/criteria/:criterionId',
  requireRole(RoleType.admin),
  asyncHandler(async (req: Request, res: Response) => {
    const tenderId = parseId(req.params.tenderId);
    const criterionId = parseId(req.params.criterionId);
    await deleteCriterion(tenderId, criterionId);
    log.audit('criteria.delete', { userId: (req.user as CurrentUser).id, tenderId, criterionId });
    res.json({ ok: true });
  }),
);
