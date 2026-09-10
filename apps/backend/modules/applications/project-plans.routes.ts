// HTTP API плана мероприятий заявки.
import { Router } from 'express';
import type { Request, Response } from 'express';
import { asyncHandler } from '../../lib/http';
import { log } from '../../lib/logger';
import { requireAuth } from '../auth/auth.middleware';
import type { CurrentUser } from '../files/files.service';
import { parseId } from './applications.service';
import { createPlan, deletePlan, listPlans, updatePlan } from './project-plans.service';

export const projectPlansRouter = Router();
projectPlansRouter.use(requireAuth);

projectPlansRouter.get(
  '/:applicationId/project-plans',
  asyncHandler(async (req: Request, res: Response) => {
    const applicationId = parseId(req.params.applicationId);
    const plans = await listPlans(req.user as CurrentUser, applicationId);
    res.json({ plans });
  }),
);

projectPlansRouter.post(
  '/:applicationId/project-plans',
  asyncHandler(async (req: Request, res: Response) => {
    const applicationId = parseId(req.params.applicationId);
    const plan = await createPlan(req.user as CurrentUser, applicationId, req.body ?? {});
    log.audit('project_plans.create', { userId: (req.user as CurrentUser).id, applicationId, planId: plan.id });
    res.status(201).json({ plan });
  }),
);

projectPlansRouter.patch(
  '/:applicationId/project-plans/:planId',
  asyncHandler(async (req: Request, res: Response) => {
    const applicationId = parseId(req.params.applicationId);
    const planId = parseId(req.params.planId);
    const plan = await updatePlan(req.user as CurrentUser, applicationId, planId, req.body ?? {});
    res.json({ plan });
  }),
);

projectPlansRouter.delete(
  '/:applicationId/project-plans/:planId',
  asyncHandler(async (req: Request, res: Response) => {
    const applicationId = parseId(req.params.applicationId);
    const planId = parseId(req.params.planId);
    await deletePlan(req.user as CurrentUser, applicationId, planId);
    log.audit('project_plans.delete', { userId: (req.user as CurrentUser).id, applicationId, planId });
    res.json({ ok: true });
  }),
);
