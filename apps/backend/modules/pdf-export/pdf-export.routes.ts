// HTTP API модуля pdf-export: создание задания и получение статуса/файла.
import { Router } from 'express';
import type { Request, Response } from 'express';
import { PdfExportStatus } from '@arbuz/shared';
import { prisma } from '../../lib/prisma';
import { asyncHandler, httpError } from '../../lib/http';
import { log } from '../../lib/logger';
import { parseId } from '../../lib/parse';
import { requireAuth } from '../auth/auth.middleware';
import type { CurrentUser } from '../files/files.service';
import { fileMime, safeOriginalName } from '../files/file-validation';
import { openStored } from '../files/file-storage';
import { requireAdmin } from '../reviews/summary.service';
import { getJobForUser, startApplicationExport, startReviewsExport } from './pdf-export.service';

export const pdfExportRouter = Router();
pdfExportRouter.use(requireAuth);

pdfExportRouter.post(
  '/applications/:applicationId/pdf-export',
  asyncHandler(async (req: Request, res: Response) => {
    const actor = req.user as CurrentUser;
    const applicationId = parseId(req.params.applicationId);
    const job = await startApplicationExport(actor, applicationId);
    res.status(202).json({ job });
  }),
);

// Отчёт по набору экспертиз: { expert_id } | { status_id } | { application_id } | { review_ids }
pdfExportRouter.post(
  '/reviews/pdf-export',
  asyncHandler(async (req: Request, res: Response) => {
    const actor = req.user as CurrentUser;
    requireAdmin(actor);
    const { params, label } = await parseReviewsExportBody(req.body);
    const job = await startReviewsExport(actor, params, label);
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
    if (job.status !== PdfExportStatus.done || !job.fileId) {
      throw httpError(409, 'PDF ещё не готов', 'PDF_NOT_READY');
    }

    const file = await prisma.files.findUnique({ where: { id: job.fileId } });
    if (!file || !file.path || file.deleted_at) {
      throw httpError(404, 'Файл PDF отсутствует', 'FILE_NOT_FOUND');
    }

    const { stream, size } = await openStored(file.path);
    const name = safeOriginalName(file.name || `application-${job.applicationId ?? job.id}.pdf`);
    const disposition = 'attachment';
    res.setHeader('Content-Type', fileMime(file.file_type));
    res.setHeader('Content-Length', String(size));
    res.setHeader('Content-Disposition', `${disposition}; filename*=UTF-8''${encodeURIComponent(name)}`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    log.audit('pdf-export.download', { userId: actor.id, jobId, kind: job.kind, applicationId: job.applicationId });
    stream.on('error', () => res.destroy());
    res.on('close', () => stream.destroy());
    stream.pipe(res);
  }),
);

/** Разбирает тело запроса отчёта по экспертизам: ровно один критерий отбора. */
async function parseReviewsExportBody(body: unknown): Promise<{ params: Record<string, unknown>; label: string | null }> {
  const source = (body ?? {}) as Record<string, unknown>;
  const label = typeof source.label === 'string' ? source.label.trim().slice(0, 255) || null : null;

  if (source.review_ids !== undefined) {
    if (!Array.isArray(source.review_ids) || source.review_ids.length === 0) {
      throw httpError(400, 'Выберите хотя бы одну экспертизу', 'EMPTY_SELECTION');
    }
    const review_ids = source.review_ids.map((raw) => parseId(raw, 'Некорректный идентификатор экспертизы'));
    return { params: { review_ids }, label };
  }

  if (source.expert_id !== undefined) {
    const expert_id = parseId(source.expert_id, 'Некорректный идентификатор эксперта');
    const expert = await prisma.users.findFirst({
      where: { id: expert_id, deleted_at: null },
      select: { id: true },
    });
    if (!expert) throw httpError(404, 'Эксперт не найден', 'EXPERT_NOT_FOUND');
    return { params: { expert_id }, label };
  }

  if (source.status_id !== undefined) {
    const status_id = parseId(source.status_id, 'Некорректный идентификатор вердикта');
    const status = await prisma.review_statuses.findFirst({
      where: { id: status_id, deleted_at: null },
      select: { id: true },
    });
    if (!status) throw httpError(404, 'Вердикт не найден', 'REVIEW_STATUS_NOT_FOUND');
    return { params: { status_id }, label };
  }

  if (typeof source.application_id !== 'undefined' && source.application_id !== null) {
    const application_id = parseId(source.application_id, 'Некорректный идентификатор заявки');
    return { params: { application_id }, label };
  }

  // Без критерия — сводка по всем экспертизам (админ видит их все).
  if (source.all === true) return { params: { all: true }, label };

  throw httpError(400, 'Укажите критерий отбора: expert_id, status_id, application_id, review_ids или all', 'EMPTY_SELECTION');
}
