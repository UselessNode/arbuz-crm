// HTTP API заявок.
import { Router } from 'express';
import type { Request, Response } from 'express';
import { asyncHandler } from '../../lib/http';
import { log } from '../../lib/logger';
import {
  parseDateRange,
  parseIdArray,
  parseLimitOffset,
  parseOptionalId,
  parseSearch,
  parseSort,
} from '../../lib/query';
import { requireAuth } from '../auth/auth.middleware';
import type { CurrentUser } from '../files/files.service';
import {
  createApplication,
  deleteApplication,
  getApplicationDetail,
  getApplicationForAccess,
  listApplications,
  parseId,
  submitApplication,
  updateApplication,
  validateApplication,
} from './applications.service';

export const applicationsRouter = Router();
applicationsRouter.use(requireAuth);

const APPLICATION_SORT_FIELDS = ['created_at', 'updated_at', 'title', 'status', 'owner', 'tender'] as const;

applicationsRouter.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const { limit, offset } = parseLimitOffset(req.query);
    const search = parseSearch(req.query);
    // Мультивыбор; одиночные `status_id`/`tender_id` — для обратной совместимости.
    const legacyStatus = parseOptionalId(req.query.status_id);
    const legacyTender = parseOptionalId(req.query.tender_id);
    const statusIds = parseIdArray(req.query.status_ids) ?? (legacyStatus ? [legacyStatus] : undefined);
    const tenderIds = parseIdArray(req.query.tender_ids) ?? (legacyTender ? [legacyTender] : undefined);
    const result = await listApplications(req.user as CurrentUser, {
      search,
      statusIds,
      tenderIds,
      ownerIds: parseIdArray(req.query.owner_ids),
      applicationIds: parseIdArray(req.query.application_ids),
      created: parseDateRange(req.query, 'created'),
      updated: parseDateRange(req.query, 'updated'),
      sort: parseSort(req.query, APPLICATION_SORT_FIELDS),
      limit,
      offset,
    });
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

applicationsRouter.get(
  '/:applicationId/validation',
  asyncHandler(async (req: Request, res: Response) => {
    const actor = req.user as CurrentUser;
    const applicationId = parseId(req.params.applicationId);
    await getApplicationForAccess(actor, applicationId, 'view');
    const validation = await validateApplication(applicationId);
    res.json(validation);
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
