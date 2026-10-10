// HTTP API массового удаления (только admin).
// Тело: { entity: 'reviews'|'applications'|'users'|'posts', ids: number[], password: string }.
import { Router } from 'express';
import type { Request, Response } from 'express';
import { asyncHandler } from '../../lib/http';
import { log } from '../../lib/logger';
import { requireAuth } from '../auth/auth.middleware';
import type { CurrentUser } from '../files/files.service';
import { bulkDelete } from './bulk-delete.service';

export const bulkDeleteRouter = Router();
bulkDeleteRouter.use(requireAuth);

bulkDeleteRouter.post(
  '/bulk-delete',
  asyncHandler(async (req: Request, res: Response) => {
    const actor = req.user as CurrentUser;
    const body = (req.body ?? {}) as Record<string, unknown>;
    const result = await bulkDelete(actor, body.entity, body.ids, body.password);
    log.audit('bulk.delete', { userId: actor.id, entity: result.entity, deleted: result.deleted });
    res.json(result);
  }),
);
