// HTTP API центра уведомлений (долгие уведомления текущего пользователя).
import { NotificationType } from '@arbuz/shared';
import { Router } from 'express';
import type { Request, Response } from 'express';
import { asyncHandler } from '../../lib/http';
import { parseId } from '../../lib/parse';
import { parseLimitOffset } from '../../lib/query';
import { requireAuth } from '../auth/auth.middleware';
import type { CurrentUser } from '../files/files.service';
import {
  ensureInactivityNotifications,
  listNotifications,
  markAllRead,
  markRead,
  unreadCount,
} from './notifications.service';

export const notificationsRouter = Router();

const NOTIFICATION_TYPES: readonly NotificationType[] = Object.values(NotificationType);

function parseType(raw: unknown): NotificationType | undefined {
  return typeof raw === 'string' && (NOTIFICATION_TYPES as readonly string[]).includes(raw)
    ? (raw as NotificationType)
    : undefined;
}

// Список уведомлений (с фильтром по типу) + счётчик непрочитанных.
notificationsRouter.get(
  '/',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const actor = req.user as CurrentUser;
    // Для администратора — идемпотентно создаём уведомления о давно неактивных аккаунтах.
    await ensureInactivityNotifications(actor);
    const { limit, offset } = parseLimitOffset(req.query);
    const result = await listNotifications(actor, { type: parseType(req.query.type), limit, offset });
    res.json(result);
  }),
);

// Только счётчик непрочитанных — лёгкий запрос для поллинга бейджа.
notificationsRouter.get(
  '/unread-count',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const count = await unreadCount(req.user as CurrentUser);
    res.json({ count });
  }),
);

notificationsRouter.patch(
  '/:notificationId/read',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    await markRead(req.user as CurrentUser, parseId(req.params.notificationId));
    res.json({ ok: true });
  }),
);

notificationsRouter.post(
  '/read-all',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    await markAllRead(req.user as CurrentUser);
    res.json({ ok: true });
  }),
);
