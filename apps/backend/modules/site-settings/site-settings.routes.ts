// HTTP API настраиваемых текстов сайта.
// Публично: чтение конкретной настройки (нужно публичным страницам до аутентификации).
// Только администратору: список всех и изменение.
import { RoleType } from '@arbuz/shared';
import { Router } from 'express';
import type { Request, Response } from 'express';
import { asyncHandler } from '../../lib/http';
import { log } from '../../lib/logger';
import { optionalAuth, requireAuth, requireRole } from '../auth/auth.middleware';
import { applyDownloadHeaders } from '../files/download';
import type { CurrentUser } from '../files/files.service';
import {
  getSiteSetting,
  listSiteSettings,
  openSiteImage,
  uploadSiteSettingImage,
  upsertSiteSetting,
} from './site-settings.service';

export const siteSettingsRouter = Router();
siteSettingsRouter.use(optionalAuth);

// Публичная отдача картинки блока (без аутентификации).
// Важно: объявляется до `/:key`, иначе параметр перехватит сегмент «image».
siteSettingsRouter.get(
  '/image/:fileId',
  asyncHandler(async (req: Request, res: Response) => {
    const fileId = Number(req.params.fileId);
    const image = await openSiteImage(Number.isInteger(fileId) && fileId > 0 ? fileId : 0);
    applyDownloadHeaders(res, image.file.name, image.file.file_type, image.size);
    image.stream.on('error', () => res.destroy());
    res.on('close', () => image.stream.destroy());
    image.stream.pipe(res);
  }),
);

// Публичное чтение одной настройки — для главной, подвала и страницы «О проекте».
siteSettingsRouter.get(
  '/:key',
  asyncHandler(async (req: Request, res: Response) => {
    const setting = await getSiteSetting(req.params.key);
    res.json({ setting });
  }),
);

// Полный список — только администратор (экран настройки).
siteSettingsRouter.get(
  '/',
  requireAuth,
  requireRole(RoleType.admin),
  asyncHandler(async (_req: Request, res: Response) => {
    const settings = await listSiteSettings();
    res.json({ settings });
  }),
);

siteSettingsRouter.put(
  '/:key',
  requireAuth,
  requireRole(RoleType.admin),
  asyncHandler(async (req: Request, res: Response) => {
    const setting = await upsertSiteSetting(req.user as CurrentUser, req.params.key, req.body?.text);
    log.audit('site-settings.update', { userId: (req.user as CurrentUser).id, key: setting.key });
    res.json({ setting });
  }),
);

// Вставка картинки в текст блока: файл сохраняется и сразу отдаётся публично по id.
siteSettingsRouter.post(
  '/:key/image',
  requireAuth,
  requireRole(RoleType.admin),
  asyncHandler(async (req: Request, res: Response) => {
    const url = await uploadSiteSettingImage(req.user as CurrentUser, req.params.key, req);
    res.status(201).json({ url });
  }),
);
