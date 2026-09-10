// HTTP API бюджета заявки.
import { Router } from 'express';
import type { Request, Response } from 'express';
import { asyncHandler } from '../../lib/http';
import { log } from '../../lib/logger';
import { requireAuth } from '../auth/auth.middleware';
import type { CurrentUser } from '../files/files.service';
import { parseId } from './applications.service';
import { createBudgetItem, deleteBudgetItem, listBudget, updateBudgetItem } from './project-budget.service';

export const projectBudgetRouter = Router();
projectBudgetRouter.use(requireAuth);

projectBudgetRouter.get(
  '/:applicationId/project-budget',
  asyncHandler(async (req: Request, res: Response) => {
    const applicationId = parseId(req.params.applicationId);
    const items = await listBudget(req.user as CurrentUser, applicationId);
    res.json({ items });
  }),
);

projectBudgetRouter.post(
  '/:applicationId/project-budget',
  asyncHandler(async (req: Request, res: Response) => {
    const applicationId = parseId(req.params.applicationId);
    const item = await createBudgetItem(req.user as CurrentUser, applicationId, req.body ?? {});
    log.audit('project_budget.create', { userId: (req.user as CurrentUser).id, applicationId, itemId: item.id });
    res.status(201).json({ item });
  }),
);

projectBudgetRouter.patch(
  '/:applicationId/project-budget/:itemId',
  asyncHandler(async (req: Request, res: Response) => {
    const applicationId = parseId(req.params.applicationId);
    const itemId = parseId(req.params.itemId);
    const item = await updateBudgetItem(req.user as CurrentUser, applicationId, itemId, req.body ?? {});
    res.json({ item });
  }),
);

projectBudgetRouter.delete(
  '/:applicationId/project-budget/:itemId',
  asyncHandler(async (req: Request, res: Response) => {
    const applicationId = parseId(req.params.applicationId);
    const itemId = parseId(req.params.itemId);
    await deleteBudgetItem(req.user as CurrentUser, applicationId, itemId);
    log.audit('project_budget.delete', { userId: (req.user as CurrentUser).id, applicationId, itemId });
    res.json({ ok: true });
  }),
);
