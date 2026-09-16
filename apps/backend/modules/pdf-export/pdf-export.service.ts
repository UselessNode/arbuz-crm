// Сервис асинхронной генерации PDF: создание задания, запуск фонового воркера
// и восстановление «зависших» заданий после рестарта сервера.
//
// Параллелизм намеренно не развивается: отчёты создаёт один администратор,
// поэтому «1 отчёт = 1 задание = 1 процесс воркера». Ограничением служит
// сам факт, что экспорт запускается вручную.
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { PdfExportStatus, PdfReportKinds } from '@arbuz/shared';
import { prisma } from '../../lib/prisma';
import { httpError } from '../../lib/http';
import { log } from '../../lib/logger';
import type { CurrentUser } from '../files/files.service';
import { requireViewableApplication } from '../files/files.service';
import { requireAdmin } from '../reviews/summary.service';
import { STALE_JOB_TIMEOUT_MS, WORKER_JOB_ARG, WORKER_TIMEOUT_MS } from './constants';

const workerPath = fileURLToPath(new URL('../../scripts/pdf-worker.ts', import.meta.url));

export interface PdfExportJob {
  id: number;
  kind: PdfReportKinds;
  applicationId: number | null;
  label: string | null;
  status: PdfExportStatus;
  fileId: number | null;
  error: string | null;
  createdAt: Date;
  updatedAt: Date;
}

function serializeJob(job: {
  id: number;
  kind: PdfReportKinds;
  application_id: number | null;
  label: string | null;
  status: PdfExportStatus;
  file_id: number | null;
  error: string | null;
  created_at: Date;
  updated_at: Date;
}): PdfExportJob {
  return {
    id: job.id,
    kind: job.kind,
    applicationId: job.application_id,
    label: job.label,
    status: job.status,
    fileId: job.file_id,
    error: job.error,
    createdAt: job.created_at,
    updatedAt: job.updated_at,
  };
}

function failPendingJob(jobId: number, message: string): void {
  // `updateMany` с фильтром по статусу не перезатрёт уже готовое задание.
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

/** Помечает задания, застрявшие в генерации, ошибкой (вызывается при старте сервера). */
export async function recoverStaleJobs(): Promise<number> {
  const threshold = new Date(Date.now() - STALE_JOB_TIMEOUT_MS);
  const result = await prisma.pdf_export_jobs.updateMany({
    where: {
      status: { in: [PdfExportStatus.pending, PdfExportStatus.processing] },
      created_at: { lt: threshold },
    },
    data: {
      status: PdfExportStatus.error,
      error: 'Генерация была прервана (перезапуск сервера). Создайте отчёт заново.',
    },
  });
  if (result.count > 0) log.warn('pdf-export: восстановление после перезапуска', { jobs: result.count });
  return result.count;
}

/**
 * Отчёт по одной заявке (9 секций + бюджет).
 * Доступен всем, кто видит заявку: владелец, администратор, назначенный эксперт.
 */
export async function startApplicationExport(user: CurrentUser, applicationId: number): Promise<PdfExportJob> {
  await requireViewableApplication(user, applicationId);
  return createJob(user, {
    kind: PdfReportKinds.application,
    applicationId,
    params: { application_id: applicationId },
    label: null,
  });
}

/**
 * Отчёт по набору экспертиз. Доступен **только администратору**: сводка пересекает заявки,
 * поэтому проверки «видит заявку» недостаточно — эксперт с доступом к одной заявке
 * не должен получить сводку по конкурсу.
 */
export async function startReviewsExport(
  user: CurrentUser,
  params: Record<string, unknown>,
  label: string | null,
): Promise<PdfExportJob> {
  // Проверка дублируется в сервисе (а не только в роуте): сводка не должна
  // появиться ни из какого другого вызова.
  requireAdmin(user);
  return createJob(user, { kind: PdfReportKinds.reviews, applicationId: null, params, label });
}

async function createJob(
  user: CurrentUser,
  input: {
    kind: PdfReportKinds;
    applicationId: number | null;
    params: Record<string, unknown>;
    label: string | null;
  },
): Promise<PdfExportJob> {
  const job = await prisma.pdf_export_jobs.create({
    data: {
      kind: input.kind,
      application_id: input.applicationId,
      // Prisma ждёт InputJsonValue; наши параметры — плоский объект примитивов.
      params: input.params as never,
      label: input.label,
      status: PdfExportStatus.pending,
    },
  });
  log.audit('pdf-export.start', {
    userId: user.id,
    jobId: job.id,
    kind: input.kind,
    applicationId: input.applicationId,
    label: input.label,
  });
  runWorker(job.id);
  return serializeJob(job);
}

/** Возвращает задание с проверкой прав. */
export async function getJobForUser(user: CurrentUser, jobId: number): Promise<PdfExportJob> {
  const job = await prisma.pdf_export_jobs.findUnique({ where: { id: jobId } });
  if (!job) throw httpError(404, 'Задание не найдено', 'PDF_JOB_NOT_FOUND');
  // Сводка по экспертизам пересекает заявки — она админская и на старте, и при чтении
  // результата: иначе любой авторизованный пользователь скачал бы её, угадав id задания.
  if (job.kind === PdfReportKinds.reviews) {
    requireAdmin(user);
  } else if (job.application_id !== null) {
    await requireViewableApplication(user, job.application_id);
  }
  return serializeJob(job);
}
