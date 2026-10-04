// HTTP API подсказок к разделам формы заявки.
// Чтение — всем авторизованным, изменение — администратору.
import { RoleType } from '@arbuz/shared';
import { Router } from 'express';
import type { Request, Response } from 'express';
import { asyncHandler } from '../../lib/http';
import { log } from '../../lib/logger';
import { requireAuth, requireRole } from '../auth/auth.middleware';
import type { CurrentUser } from '../files/files.service';
import { listSectionHints, upsertSectionHint } from './section-hints.service';

export const sectionHintsRouter = Router();
sectionHintsRouter.use(requireAuth);

sectionHintsRouter.get(
  '/',
  asyncHandler(async (_req: Request, res: Response) => {
    const hints = await listSectionHints();
    res.json({ hints });
  }),
);

sectionHintsRouter.put(
  '/:sectionKey',
  requireRole(RoleType.admin),
  asyncHandler(async (req: Request, res: Response) => {
    const hint = await upsertSectionHint(req.params.sectionKey, req.body?.text);
    log.audit('section-hints.update', { userId: (req.user as CurrentUser).id, sectionKey: hint.sectionKey });
    res.json({ hint });
  }),
);
