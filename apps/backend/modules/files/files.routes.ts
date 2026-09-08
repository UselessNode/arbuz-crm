// HTTP API модуля файлов. Все маршруты требуют аутентификации;
// права проверяются по владельцу заявки или роли администратора.
import { Router } from 'express';
import type { Request, Response } from 'express';
import { prisma } from '../../lib/prisma';
import { config } from '../../lib/config';
import { asyncHandler, httpError } from '../../lib/http';
import { log } from '../../lib/logger';
import { readMultipartFile } from '../../lib/multipart';
import { requireAuth } from '../auth/auth.middleware';
import type { CurrentUser } from './files.service';
import {
  applicationUsedBytes,
  requireManageableApplication,
  requireTeamMemberOfApplication,
  resolveApplicationFolder,
  syncMemberConsentPath,
} from './files.service';
import { fileMime, isPreviewableFile, safeOriginalName, validateUpload } from './file-validation';
import { openStored, removeStored, storeUpload } from './file-storage';

export const filesRouter = Router();
filesRouter.use(requireAuth);

function parseId(raw: string | undefined): number {
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) {
    throw httpError(400, 'Некорректный идентификатор', 'INVALID_ID');
  }
  return value;
}

function assertApplicationQuota(applicationId: number, newBytes: number): Promise<number> {
  return applicationUsedBytes(applicationId).then((usedBytes) => {
    const mb = Math.floor(config.limits.maxApplicationBytes / (1024 * 1024));
    if (usedBytes + newBytes > config.limits.maxApplicationBytes) {
      throw httpError(
        413,
        `Превышен общий лимит файлов заявки (${mb} МБ). Удалите часть файлов или уменьшите их размер.`,
        'APPLICATION_QUOTA_EXCEEDED',
      );
    }
    return usedBytes;
  });
}

// --- Сериализация для клиента (пути на диске наружу не отдаём) ---

interface MaterialRow {
  id: number;
  file_name: string;
  file_type: string | null;
  file_bytes_size: unknown | null;
  comment: string | null;
  uploaded_at: Date;
}

function serializeMaterial(row: MaterialRow) {
  return {
    id: row.id,
    fileName: row.file_name,
    fileType: row.file_type,
    sizeBytes: row.file_bytes_size === null || row.file_bytes_size === undefined ? null : Number(row.file_bytes_size),
    comment: row.comment,
    uploadedAt: row.uploaded_at,
  };
}

interface ConsentRow {
  id: number;
  file_name: string | null;
  file_type: string | null;
  file_size: number | null;
  uploaded_at: Date;
}

function serializeConsent(row: ConsentRow) {
  return {
    id: row.id,
    fileName: row.file_name,
    fileType: row.file_type,
    sizeBytes: row.file_size,
    uploadedAt: row.uploaded_at,
  };
}

function setDownloadHeaders(res: Response, fileName: string | null, fileType: string | null, size: number): void {
  const disposition = isPreviewableFile(fileType) ? 'inline' : 'attachment';
  const encoded = encodeURIComponent(fileName ?? 'file');
  res.setHeader('Content-Type', fileMime(fileType));
  res.setHeader('Content-Length', String(size));
  res.setHeader('Content-Disposition', `${disposition}; filename*=UTF-8''${encoded}`);
  res.setHeader('X-Content-Type-Options', 'nosniff');
}

// --- Прикреплённые файлы (additional_materials) ---

filesRouter.post(
  '/:applicationId/files',
  asyncHandler(async (req: Request, res: Response) => {
    const actor = req.user as CurrentUser;
    const applicationId = parseId(req.params.applicationId);
    const application = await requireManageableApplication(actor, applicationId);
    const { buffer, originalName, comment } = await readMultipartFile(req);

    const type = validateUpload(buffer, originalName);
    await assertApplicationQuota(applicationId, buffer.byteLength);

    const folder = await resolveApplicationFolder(applicationId, application.owner_id);
    const relativePath = await storeUpload(buffer, folder, type);

    const record = await prisma.additional_materials.create({
      data: {
        application_id: applicationId,
        file_path: relativePath,
        file_name: safeOriginalName(originalName),
        file_type: type,
        file_bytes_size: buffer.byteLength,
        comment,
      },
    });
    log.audit('files.material.upload', {
      userId: actor.id,
      applicationId,
      fileId: record.id,
      fileName: record.file_name,
      sizeBytes: buffer.byteLength,
      path: relativePath,
    });
    res.status(201).json({ material: serializeMaterial(record) });
  }),
);

filesRouter.get(
  '/:applicationId/files',
  asyncHandler(async (req: Request, res: Response) => {
    const actor = req.user as CurrentUser;
    const applicationId = parseId(req.params.applicationId);
    await requireManageableApplication(actor, applicationId);
    const materials = await prisma.additional_materials.findMany({
      where: { application_id: applicationId, deleted_at: null },
      orderBy: { id: 'desc' },
    });
    res.json({ materials: materials.map(serializeMaterial) });
  }),
);

filesRouter.get(
  '/:applicationId/files/:fileId/download',
  asyncHandler(async (req: Request, res: Response) => {
    const actor = req.user as CurrentUser;
    const applicationId = parseId(req.params.applicationId);
    const fileId = parseId(req.params.fileId);
    await requireManageableApplication(actor, applicationId);

    const record = await prisma.additional_materials.findFirst({
      where: { id: fileId, application_id: applicationId, deleted_at: null },
    });
    if (!record) throw httpError(404, 'Файл не найден', 'FILE_NOT_FOUND');

    const { stream, size } = await openStored(record.file_path);
    setDownloadHeaders(res, record.file_name, record.file_type, size);
    log.audit('files.material.download', { userId: actor.id, applicationId, fileId, fileName: record.file_name });
    stream.on('error', () => res.destroy());
    res.on('close', () => stream.destroy());
    stream.pipe(res);
  }),
);

filesRouter.delete(
  '/:applicationId/files/:fileId',
  asyncHandler(async (req: Request, res: Response) => {
    const actor = req.user as CurrentUser;
    const applicationId = parseId(req.params.applicationId);
    const fileId = parseId(req.params.fileId);
    await requireManageableApplication(actor, applicationId);

    const record = await prisma.additional_materials.findFirst({
      where: { id: fileId, application_id: applicationId, deleted_at: null },
    });
    if (!record) throw httpError(404, 'Файл не найден', 'FILE_NOT_FOUND');

    await prisma.additional_materials.update({ where: { id: fileId }, data: { deleted_at: new Date() } });
    await removeStored(record.file_path);
    log.audit('files.material.delete', { userId: actor.id, applicationId, fileId, fileName: record.file_name });
    res.json({ ok: true });
  }),
);

// --- Файлы согласий (consent_files) ---

filesRouter.get(
  '/:applicationId/team-members/:memberId/consents',
  asyncHandler(async (req: Request, res: Response) => {
    const actor = req.user as CurrentUser;
    const applicationId = parseId(req.params.applicationId);
    const memberId = parseId(req.params.memberId);
    await requireManageableApplication(actor, applicationId);
    await requireTeamMemberOfApplication(applicationId, memberId);

    const consents = await prisma.consent_files.findMany({
      where: { team_member_id: memberId, deleted_at: null },
      orderBy: { id: 'desc' },
    });
    res.json({ consents: consents.map(serializeConsent) });
  }),
);

filesRouter.post(
  '/:applicationId/team-members/:memberId/consents',
  asyncHandler(async (req: Request, res: Response) => {
    const actor = req.user as CurrentUser;
    const applicationId = parseId(req.params.applicationId);
    const memberId = parseId(req.params.memberId);
    const application = await requireManageableApplication(actor, applicationId);
    await requireTeamMemberOfApplication(applicationId, memberId);

    const { buffer, originalName } = await readMultipartFile(req);
    const type = validateUpload(buffer, originalName);
    await assertApplicationQuota(applicationId, buffer.byteLength);

    const folder = await resolveApplicationFolder(applicationId, application.owner_id);
    const relativePath = await storeUpload(buffer, folder, type, 'consents');

    const record = await prisma.consent_files.create({
      data: {
        team_member_id: memberId,
        file_path: relativePath,
        file_name: safeOriginalName(originalName),
        file_type: type,
        file_size: buffer.byteLength,
      },
    });
    await syncMemberConsentPath(memberId);
    log.audit('files.consent.upload', {
      userId: actor.id,
      applicationId,
      teamMemberId: memberId,
      consentId: record.id,
      fileName: record.file_name,
      sizeBytes: buffer.byteLength,
    });
    res.status(201).json({ consent: serializeConsent(record) });
  }),
);

filesRouter.get(
  '/:applicationId/consents/:consentId/download',
  asyncHandler(async (req: Request, res: Response) => {
    const actor = req.user as CurrentUser;
    const applicationId = parseId(req.params.applicationId);
    const consentId = parseId(req.params.consentId);
    await requireManageableApplication(actor, applicationId);

    const record = await prisma.consent_files.findFirst({
      where: { id: consentId, deleted_at: null, team_members: { application_id: applicationId } },
    });
    if (!record) throw httpError(404, 'Файл согласия не найден', 'CONSENT_NOT_FOUND');

    const { stream, size } = await openStored(record.file_path);
    setDownloadHeaders(res, record.file_name, record.file_type, size);
    log.audit('files.consent.download', { userId: actor.id, applicationId, consentId });
    stream.on('error', () => res.destroy());
    res.on('close', () => stream.destroy());
    stream.pipe(res);
  }),
);

filesRouter.delete(
  '/:applicationId/consents/:consentId',
  asyncHandler(async (req: Request, res: Response) => {
    const actor = req.user as CurrentUser;
    const applicationId = parseId(req.params.applicationId);
    const consentId = parseId(req.params.consentId);
    await requireManageableApplication(actor, applicationId);

    const record = await prisma.consent_files.findFirst({
      where: { id: consentId, deleted_at: null, team_members: { application_id: applicationId } },
    });
    if (!record) throw httpError(404, 'Файл согласия не найден', 'CONSENT_NOT_FOUND');

    await prisma.consent_files.update({ where: { id: consentId }, data: { deleted_at: new Date() } });
    await removeStored(record.file_path);
    await syncMemberConsentPath(record.team_member_id);
    log.audit('files.consent.delete', { userId: actor.id, applicationId, consentId });
    res.json({ ok: true });
  }),
);
