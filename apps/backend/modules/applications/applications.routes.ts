// HTTP API заявок.
import { Router } from 'express';
import type { Request, Response } from 'express';
import { asyncHandler } from '../../lib/http';
import { log } from '../../lib/logger';
import { requireAuth } from '../auth/auth.middleware';
import type { CurrentUser } from '../files/files.service';
import {
  createApplication,
  deleteApplication,
  getApplicationDetail,
  listApplications,
  parseId,
  submitApplication,
  updateApplication,
} from './applications.service';

export const applicationsRouter = Router();
applicationsRouter.use(requireAuth);

function parseLimitOffset(query: Request['query']): { limit: number; offset: number } {
  const limit = Number(query.limit ?? 50);
  const offset = Number(query.offset ?? 0);
  return {
    limit: Number.isFinite(limit) ? Math.min(Math.max(Math.trunc(limit), 1), 200) : 50,
    offset: Number.isFinite(offset) ? Math.max(Math.trunc(offset), 0) : 0,
  };
}

applicationsRouter.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const { limit, offset } = parseLimitOffset(req.query);
    const result = await listApplications(req.user as CurrentUser, { limit, offset });
    res.json(result);
  }),
);

applicationsRouter.post(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const actor = req.user as CurrentUser;
    const application = await createApplication(actor, {
      title: req.body?.title,
      idea_description: req.body?.idea_description,
      importance_to_team: req.body?.importance_to_team,
      project_goal: req.body?.project_goal,
      project_tasks: req.body?.project_tasks,
      implementation_experience: req.body?.implementation_experience,
      results_description: req.body?.results_description,
      tender_id: req.body?.tender_id,
      direction_id: req.body?.direction_id,
      owner_id: req.body?.owner_id,
    });
    log.audit('applications.create', { userId: actor.id, applicationId: application.id });
    res.status(201).json({ application });
  }),
);

applicationsRouter.get(
  '/:applicationId',
  asyncHandler(async (req: Request, res: Response) => {
    const actor = req.user as CurrentUser;
    const applicationId = parseId(req.params.applicationId);
    const application = await getApplicationDetail(actor, applicationId);
    res.json({ application });
  }),
);

applicationsRouter.patch(
  '/:applicationId',
  asyncHandler(async (req: Request, res: Response) => {
    const actor = req.user as CurrentUser;
    const applicationId = parseId(req.params.applicationId);
    const application = await updateApplication(actor, applicationId, {
      title: req.body?.title,
      idea_description: req.body?.idea_description,
      importance_to_team: req.body?.importance_to_team,
      project_goal: req.body?.project_goal,
      project_tasks: req.body?.project_tasks,
      implementation_experience: req.body?.implementation_experience,
      results_description: req.body?.results_description,
      tender_id: req.body?.tender_id,
      direction_id: req.body?.direction_id,
      status_id: req.body?.status_id,
    });
    log.audit('applications.update', { userId: actor.id, applicationId: application.id });
    res.json({ application });
  }),
);

applicationsRouter.delete(
  '/:applicationId',
  asyncHandler(async (req: Request, res: Response) => {
    const actor = req.user as CurrentUser;
    const applicationId = parseId(req.params.applicationId);
    await deleteApplication(actor, applicationId);
    log.audit('applications.delete', { userId: actor.id, applicationId });
    res.json({ ok: true });
  }),
);

applicationsRouter.post(
  '/:applicationId/submit',
  asyncHandler(async (req: Request, res: Response) => {
    const actor = req.user as CurrentUser;
    const applicationId = parseId(req.params.applicationId);
    const application = await submitApplication(actor, applicationId);
    log.audit('applications.submit', { userId: actor.id, applicationId: application.id });
    res.json({ application });
  }),
);
