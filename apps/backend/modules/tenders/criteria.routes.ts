// HTTP API критериев оценивания тендера. Чтение — авторизованным (эксперт/админ), изменения — админ.
import { RoleType } from '@arbuz/shared';
import { Router } from 'express';
import type { Request, Response } from 'express';
import { asyncHandler } from '../../lib/http';
import { log } from '../../lib/logger';
import { requireAuth, requireRole } from '../auth/auth.middleware';
import type { CurrentUser } from '../files/files.service';
import { createCriterion, deleteCriterion, listCriteria, listCriteriaHistory, parseId, updateCriterion } from './criteria.service';

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

criteriaRouter.get(
  '/:tenderId/criteria-history',
  asyncHandler(async (req: Request, res: Response) => {
    const tenderId = parseId(req.params.tenderId);
    const history = await listCriteriaHistory(tenderId);
    res.json({ history });
  }),
);

criteriaRouter.post(
  '/:tenderId/criteria',
  requireRole(RoleType.admin),
  asyncHandler(async (req: Request, res: Response) => {
    const tenderId = parseId(req.params.tenderId);
    const criterion = await createCriterion(tenderId, req.body ?? {}, (req.user as CurrentUser).id);
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
    const criterion = await updateCriterion(tenderId, criterionId, req.body ?? {}, (req.user as CurrentUser).id);
    res.json({ criterion });
  }),
);

criteriaRouter.delete(
  '/:tenderId/criteria/:criterionId',
  requireRole(RoleType.admin),
  asyncHandler(async (req: Request, res: Response) => {
    const tenderId = parseId(req.params.tenderId);
    const criterionId = parseId(req.params.criterionId);
    await deleteCriterion(tenderId, criterionId, (req.user as CurrentUser).id);
    log.audit('criteria.delete', { userId: (req.user as CurrentUser).id, tenderId, criterionId });
    res.json({ ok: true });
  }),
);
