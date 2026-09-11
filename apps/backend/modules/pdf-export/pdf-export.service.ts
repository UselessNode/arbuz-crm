// Сервис асинхронной генерации PDF: создание задания и запуск фонового воркера.
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { PdfExportStatus } from '@arbuz/shared';
import { prisma } from '../../lib/prisma';
import { httpError } from '../../lib/http';
import { log } from '../../lib/logger';
import type { CurrentUser } from '../files/files.service';
import { requireViewableApplication } from '../files/files.service';
import { WORKER_JOB_ARG } from './constants';

const workerPath = fileURLToPath(new URL('../../scripts/pdf-worker.ts', import.meta.url));

export interface PdfExportJob {
  id: number;
  applicationId: number;
  status: PdfExportStatus;
  fileId: number | null;
  error: string | null;
  createdAt: Date;
  updatedAt: Date;
}

function serializeJob(job: {
  id: number;
  application_id: number;
  status: PdfExportStatus;
  file_id: number | null;
  error: string | null;
  created_at: Date;
  updated_at: Date;
}): PdfExportJob {
  return {
    id: job.id,
    applicationId: job.application_id,
    status: job.status,
    fileId: job.file_id,
    error: job.error,
    createdAt: job.created_at,
    updatedAt: job.updated_at,
  };
}

// Максимальное время генерации; по истечении воркер принудительно завершается.
const WORKER_TIMEOUT_MS = 5 * 60 * 1000;

/**
 * Переводит незавершённое задание в статус ошибки.
 * `updateMany` с фильтром по статусу не перезатрёт уже готовое задание.
 */
function failPendingJob(jobId: number, message: string): void {
  prisma.pdf_export_jobs
    .updateMany({
      where: { id: jobId, status: { in: [PdfExportStatus.pending, PdfExportStatus.processing] } },
      data: { status: PdfExportStatus.error, error: message },
    })
    .catch(() => undefined);
}

function runWorker(jobId: number): void {
  const child = spawn(process.execPath, [workerPath, WORKER_JOB_ARG, String(jobId)], {
    env: process.env as Record<string, string>,
    stdio: 'ignore',
    windowsHide: true,
  });

  // Страховка: если воркер завис или умер, не успев обновить статус, — фиксируем ошибку.
  const watchdog = setTimeout(() => {
    log.error('pdf-export: воркер не завершился вовремя', { jobId });
    child.kill();
    failPendingJob(jobId, 'Превышено время генерации PDF');
  }, WORKER_TIMEOUT_MS);
  (watchdog as { unref?: () => void }).unref?.();

  child.on('error', (error) => {
    clearTimeout(watchdog);
    log.error('pdf-export: не удалось запустить воркер', { jobId, error: String(error) });
    failPendingJob(jobId, `Не удалось запустить воркер: ${String(error)}`);
  });

  child.on('exit', (code) => {
    clearTimeout(watchdog);
    if (code !== 0) {
      log.error('pdf-export: воркер завершился с ошибкой', { jobId, code });
      failPendingJob(jobId, `Воркер завершился с кодом ${code}`);
    }
  });
}

export async function startExport(user: CurrentUser, applicationId: number): Promise<PdfExportJob> {
  // PDF доступен всем, кто видит заявку: владелец, администратор, назначенный эксперт.
  await requireViewableApplication(user, applicationId);
  const job = await prisma.pdf_export_jobs.create({ data: { application_id: applicationId, status: PdfExportStatus.pending } });
  log.audit('pdf-export.start', { userId: user.id, applicationId, jobId: job.id });
  runWorker(job.id);
  return serializeJob(job);
}

/** Возвращает задание с проверкой прав (владелец/админ/назначенный эксперт). */
export async function getJobForUser(user: CurrentUser, jobId: number): Promise<PdfExportJob> {
  const job = await prisma.pdf_export_jobs.findUnique({ where: { id: jobId } });
  if (!job) throw httpError(404, 'Задание не найдено', 'PDF_JOB_NOT_FOUND');
  await requireViewableApplication(user, job.application_id);
  return serializeJob(job);
}
