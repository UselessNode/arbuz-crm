// HTTP API модуля pdf-export: создание задания и получение статуса/файла.
import { Router } from 'express';
import type { Request, Response } from 'express';
import { prisma } from '../../lib/prisma';
import { asyncHandler, httpError } from '../../lib/http';
import { log } from '../../lib/logger';
import { requireAuth } from '../auth/auth.middleware';
import type { CurrentUser } from '../files/files.service';
import { fileMime, safeOriginalName } from '../files/file-validation';
import { openStored } from '../files/file-storage';
import { getJobForUser, startExport } from './pdf-export.service';

export const pdfExportRouter = Router();
pdfExportRouter.use(requireAuth);

function parseId(raw: string | undefined): number {
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) {
    throw httpError(400, 'Некорректный идентификатор', 'INVALID_ID');
  }
  return value;
}

pdfExportRouter.post(
  '/applications/:applicationId/pdf-export',
  asyncHandler(async (req: Request, res: Response) => {
    const actor = req.user as CurrentUser;
    const applicationId = parseId(req.params.applicationId);
    const job = await startExport(actor, applicationId);
    res.status(202).json({ job });
  }),
);

pdfExportRouter.get(
  '/pdf-export-jobs/:jobId',
  asyncHandler(async (req: Request, res: Response) => {
    const actor = req.user as CurrentUser;
    const jobId = parseId(req.params.jobId);
    const job = await getJobForUser(actor, jobId);
    res.json({ job });
  }),
);

pdfExportRouter.get(
  '/pdf-export-jobs/:jobId/download',
  asyncHandler(async (req: Request, res: Response) => {
    const actor = req.user as CurrentUser;
    const jobId = parseId(req.params.jobId);
    const job = await getJobForUser(actor, jobId);
    if (job.status !== 'done' || !job.fileId) {
      throw httpError(409, 'PDF ещё не готов', 'PDF_NOT_READY');
    }

    const file = await prisma.files.findUnique({ where: { id: job.fileId } });
    if (!file || !file.path || file.deleted_at) {
      throw httpError(404, 'Файл PDF отсутствует', 'FILE_NOT_FOUND');
    }

    const { stream, size } = await openStored(file.path);
    const name = safeOriginalName(file.name || `application-${job.applicationId}.pdf`);
    const disposition = 'attachment';
    res.setHeader('Content-Type', fileMime(file.file_type));
    res.setHeader('Content-Length', String(size));
    res.setHeader('Content-Disposition', `${disposition}; filename*=UTF-8''${encodeURIComponent(name)}`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    log.audit('pdf-export.download', { userId: actor.id, jobId, applicationId: job.applicationId });
    stream.on('error', () => res.destroy());
    res.on('close', () => stream.destroy());
    stream.pipe(res);
  }),
);
