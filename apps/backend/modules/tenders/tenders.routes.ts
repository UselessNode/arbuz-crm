// HTTP API тендеров (конкурсов). Чтение — всем авторизованным, изменения — администратору.
import { RoleType } from '@arbuz/shared';
import { Router } from 'express';
import type { Request, Response } from 'express';
import { asyncHandler } from '../../lib/http';
import { log } from '../../lib/logger';
import { requireAuth, requireRole } from '../auth/auth.middleware';
import type { CurrentUser } from '../files/files.service';
import { createTender, deleteTender, getTenderOrThrow, listTenders, parseId, updateTender } from './tenders.service';

export const tendersRouter = Router();
tendersRouter.use(requireAuth);

tendersRouter.get(
  '/',
  asyncHandler(async (_req: Request, res: Response) => {
    const tenders = await listTenders();
    res.json({ tenders });
  }),
);

tendersRouter.post(
  '/',
  requireRole(RoleType.admin),
  asyncHandler(async (req: Request, res: Response) => {
    const tender = await createTender({ name: req.body?.name, description: req.body?.description });
    log.audit('tenders.create', { userId: (req.user as CurrentUser).id, tenderId: tender.id });
    res.status(201).json({ tender });
  }),
);

tendersRouter.get(
  '/:tenderId',
  asyncHandler(async (req: Request, res: Response) => {
    const tender = await getTenderOrThrow(parseId(req.params.tenderId));
    res.json({ tender });
  }),
);

tendersRouter.patch(
  '/:tenderId',
  requireRole(RoleType.admin),
  asyncHandler(async (req: Request, res: Response) => {
    const tender = await updateTender(parseId(req.params.tenderId), {
      name: req.body?.name,
      description: req.body?.description,
    });
    res.json({ tender });
  }),
);

tendersRouter.delete(
  '/:tenderId',
  requireRole(RoleType.admin),
  asyncHandler(async (req: Request, res: Response) => {
    const tenderId = parseId(req.params.tenderId);
    await deleteTender(tenderId);
    log.audit('tenders.delete', { userId: (req.user as CurrentUser).id, tenderId });
    res.json({ ok: true });
  }),
);
