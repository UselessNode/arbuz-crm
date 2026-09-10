// HTTP API участников команды заявки.
import { Router } from 'express';
import type { Request, Response } from 'express';
import { asyncHandler } from '../../lib/http';
import { log } from '../../lib/logger';
import { requireAuth } from '../auth/auth.middleware';
import type { CurrentUser } from '../files/files.service';
import { parseId } from './applications.service';
import { createTeamMember, deleteTeamMember, listTeamMembers, updateTeamMember } from './team-members.service';

export const teamMembersRouter = Router();
teamMembersRouter.use(requireAuth);

teamMembersRouter.get(
  '/:applicationId/team-members',
  asyncHandler(async (req: Request, res: Response) => {
    const applicationId = parseId(req.params.applicationId);
    const members = await listTeamMembers(req.user as CurrentUser, applicationId);
    res.json({ members });
  }),
);

teamMembersRouter.post(
  '/:applicationId/team-members',
  asyncHandler(async (req: Request, res: Response) => {
    const applicationId = parseId(req.params.applicationId);
    const member = await createTeamMember(req.user as CurrentUser, applicationId, req.body ?? {});
    log.audit('team_members.create', { userId: (req.user as CurrentUser).id, applicationId, memberId: member.id });
    res.status(201).json({ member });
  }),
);

teamMembersRouter.patch(
  '/:applicationId/team-members/:memberId',
  asyncHandler(async (req: Request, res: Response) => {
    const applicationId = parseId(req.params.applicationId);
    const memberId = parseId(req.params.memberId);
    const member = await updateTeamMember(req.user as CurrentUser, applicationId, memberId, req.body ?? {});
    res.json({ member });
  }),
);

teamMembersRouter.delete(
  '/:applicationId/team-members/:memberId',
  asyncHandler(async (req: Request, res: Response) => {
    const applicationId = parseId(req.params.applicationId);
    const memberId = parseId(req.params.memberId);
    await deleteTeamMember(req.user as CurrentUser, applicationId, memberId);
    log.audit('team_members.delete', { userId: (req.user as CurrentUser).id, applicationId, memberId });
    res.json({ ok: true });
  }),
);
