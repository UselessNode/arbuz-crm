// Фоновый воркер генерации PDF (запускается отдельным процессом, чтобы
// не блокировать HTTP-сервер при генерации отчётов).
// Использование: bun scripts/pdf-worker.ts --job <jobId>
import { PdfExportStatus, PdfReportKinds, RoleType } from '@arbuz/shared';
import { prisma } from '../lib/prisma';
import { log } from '../lib/logger';
import { storeUpload } from '../modules/files/file-storage';
import { FileTypes } from '../modules/files/file-validation';
import { WORKER_JOB_ARG } from '../modules/pdf-export/constants';
import {
  buildPdfDefinition,
  renderPdfBuffer,
  type ExportApplicationData,
} from '../modules/pdf-export/pdf-document';
import { buildReviewsPdfDefinition } from '../modules/pdf-export/reviews-document';
import { buildReviewSummary, type ReviewSelectionParams } from '../modules/reviews/summary.service';

function jobIdFromArgv(): number | null {
  const index = process.argv.indexOf(WORKER_JOB_ARG);
  const raw = index === -1 ? undefined : process.argv[index + 1];
  const value = Number(raw);
  return Number.isInteger(value) && value > 0 ? value : null;
}

async function loadApplicationData(applicationId: number): Promise<ExportApplicationData | null> {
  const application = await prisma.applications.findUnique({
    where: { id: applicationId },
    include: {
      tenders: true,
      directions: true,
      application_statuses: true,
      team_members: { where: { deleted_at: null }, orderBy: { id: 'asc' } },
      project_plans: { where: { deleted_at: null }, orderBy: { id: 'asc' } },
      project_budget: { where: { deleted_at: null }, orderBy: { id: 'asc' } },
      additional_materials: { where: { deleted_at: null }, orderBy: { id: 'asc' } },
    },
  });
  if (!application || application.deleted_at) return null;
  return {
    id: application.id,
    title: application.title,
    tenderName: application.tenders?.name ?? null,
    directionName: application.directions?.name ?? null,
    statusName: application.application_statuses?.name ?? null,
    idea_description: application.idea_description,
    importance_to_team: application.importance_to_team,
    project_goal: application.project_goal,
    project_tasks: application.project_tasks,
    implementation_experience: application.implementation_experience,
    results_description: application.results_description,
    team: application.team_members.map((m) => ({
      surname: m.surname,
      name: m.name,
      patronymic: m.patronymic,
      tasks_in_project: m.tasks_in_project,
    })),
    plans: application.project_plans.map((p) => ({
      task: p.task,
      event_name: p.event_name,
      start_date: p.start_date,
      end_date: p.end_date,
    })),
    budget: application.project_budget.map((b) => ({
      resource_type: b.resource_type,
      quantity: b.quantity,
      unit_cost: b.unit_cost === null ? null : Number(b.unit_cost),
      own_funds: b.own_funds === null ? null : Number(b.own_funds),
      grant_funds: b.grant_funds === null ? null : Number(b.grant_funds),
      comment: b.comment,
    })),
    materials: application.additional_materials.map((m) => ({
      file_name: m.file_name,
      file_type: m.file_type,
      file_bytes_size: m.file_bytes_size === null ? null : Number(m.file_bytes_size),
    })),
  };
}

/** Приводит `params` задания к критерию отбора сводки. */
function parseSelection(raw: unknown): ReviewSelectionParams {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('У задания не заданы параметры отбора экспертиз');
  }
  const params = raw as Record<string, unknown>;
  if (params.all === true) return { all: true };
  if (Array.isArray(params.review_ids)) {
    const review_ids = params.review_ids.map((value) => Number(value)).filter((value) => Number.isInteger(value));
    if (review_ids.length === 0) throw new Error('Набор экспертиз пуст');
    return { review_ids };
  }
  if (params.expert_id !== undefined) return { expert_id: Number(params.expert_id) };
  if (params.status_id !== undefined) return { status_id: Number(params.status_id) };
  if (params.application_id !== undefined) return { application_id: Number(params.application_id) };
  throw new Error('Неизвестный критерий отбора экспертиз');
}

/** Отчёт по заявке: 9 секций + таблица бюджета. */
async function renderApplicationReport(applicationId: number): Promise<{ buffer: Buffer; name: string }> {
  const data = await loadApplicationData(applicationId);
  if (!data) throw new Error('Заявка не найдена');
  const pdfBuffer = await renderPdfBuffer(buildPdfDefinition(data));
  return { buffer: Buffer.from(pdfBuffer), name: `заявка-${data.id}.pdf` };
}

/** Отчёт по набору экспертиз: сводка (единый источник данных с экраном). */
async function renderReviewsReport(params: unknown, label: string | null): Promise<{ buffer: Buffer; name: string }> {
  const selection = parseSelection(params);
  // Сводка требует прав администратора; воркер работает от системного контекста,
  // а доступ уже проверен на входе в API (`startReviewsExport`).
  const summary = await buildReviewSummary({ id: 0, email: '', role: RoleType.admin }, selection);
  const pdfBuffer = await renderPdfBuffer(buildReviewsPdfDefinition(summary));
  const suffix = new Date().toISOString().slice(0, 10);
  return { buffer: Buffer.from(pdfBuffer), name: `${(label ?? 'сводка-по-экспертизам').slice(0, 80)}-${suffix}.pdf` };
}

async function main(): Promise<void> {
  const jobId = jobIdFromArgv();
  if (!jobId) throw new Error(`Укажите ${WORKER_JOB_ARG} <id>`);

  const job = await prisma.pdf_export_jobs.findUnique({ where: { id: jobId } });
  if (!job) throw new Error(`Задание ${jobId} не найдено`);
  await prisma.pdf_export_jobs.update({ where: { id: jobId }, data: { status: PdfExportStatus.processing } });

  try {
    const report =
      job.kind === PdfReportKinds.reviews
        ? await renderReviewsReport(job.params, job.label)
        : await renderApplicationReport(job.application_id ?? 0);

    const relativePath = await storeUpload(report.buffer, `pdf/${job.kind}-${job.id}`, FileTypes.PDF);
    const file = await prisma.files.create({
      data: { name: report.name, file_type: FileTypes.PDF, path: relativePath },
    });
    await prisma.pdf_export_jobs.update({
      where: { id: jobId },
      data: { status: PdfExportStatus.done, file_id: file.id, error: null },
    });
    log.audit('pdf-export.done', {
      jobId,
      kind: job.kind,
      fileId: file.id,
      bytes: report.buffer.byteLength,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await prisma.pdf_export_jobs.update({
      where: { id: jobId },
      data: { status: PdfExportStatus.error, error: message },
    });
    log.error('pdf-export.failed', { jobId, error: message });
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(async (error) => {
  console.error('[pdf-worker] Ошибка запуска:', error);
  await prisma.$disconnect().catch(() => undefined);
  process.exit(1);
});
