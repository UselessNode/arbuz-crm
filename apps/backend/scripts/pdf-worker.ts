// Фоновый воркер генерации PDF (запускается отдельным процессом, чтобы
// не блокировать HTTP-сервер при массовой генерации отчётов).
// Использование: bun scripts/pdf-worker.ts --job <jobId>
import { PdfExportStatus } from '@arbuz/shared';
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

async function main(): Promise<void> {
  const jobId = jobIdFromArgv();
  if (!jobId) throw new Error(`Укажите ${WORKER_JOB_ARG} <id>`);

  const job = await prisma.pdf_export_jobs.findUnique({ where: { id: jobId } });
  if (!job) throw new Error(`Задание ${jobId} не найдено`);
  await prisma.pdf_export_jobs.update({ where: { id: jobId }, data: { status: PdfExportStatus.processing } });

  try {
    const data = await loadApplicationData(job.application_id);
    if (!data) throw new Error('Заявка не найдена');

    const pdfBuffer = await renderPdfBuffer(buildPdfDefinition(data));
    const relativePath = await storeUpload(Buffer.from(pdfBuffer), `pdf/${data.id}`, FileTypes.PDF);

    const file = await prisma.files.create({
      data: {
        name: `заявка-${data.id}.pdf`,
        file_type: FileTypes.PDF,
        path: relativePath,
      },
    });
    await prisma.pdf_export_jobs.update({
      where: { id: jobId },
      data: { status: PdfExportStatus.done, file_id: file.id, error: null },
    });
    log.audit('pdf-export.done', { jobId, applicationId: data.id, fileId: file.id, bytes: pdfBuffer.byteLength });
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
