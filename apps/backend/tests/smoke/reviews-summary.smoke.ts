// Смоук: сводка по экспертизам — тот же источник данных, что и PDF-отчёт.
//
// Проверяем, что сводка собирается по критерию отбора, считает итоги и что
// агрегат доступен только администратору (эксперт не должен видеть сводку по конкурсу).
import { PdfReportKinds, RoleType } from '@arbuz/shared';
import { prisma } from '../../lib/prisma';
import { buildReviewSummary, formatPerson } from '../../modules/reviews/summary.service';
import { getJobForUser, startReviewsExport } from '../../modules/pdf-export/pdf-export.service';
import { createSmoke } from '../helpers/smoke';
import { asExpert, requireAdmin } from '../helpers/actors';

const smoke = createSmoke('reviews-summary (сводка по экспертизам)');

/** Метка задания, создаваемого для проверки прав (удаляем за собой). */
const SMOKE_LABEL = '[smoke] сводка';

async function main(): Promise<void> {
  const admin = await requireAdmin();
  let jobId: number | null = null;

  try {
    const expert = await prisma.users.findFirst({
      where: { role: RoleType.expert, deleted_at: null },
      select: { id: true, email: true },
    });
    if (!expert) throw new Error('[smoke] В dev-базе нет эксперта — выполните `bun seed`');

    // Сводка по эксперту: только его экспертизы.
    const byExpert = await buildReviewSummary(admin, { expert_id: expert.id });
    smoke.ok('сводка по эксперту: заголовок содержит ФИО', byExpert.title.startsWith('Эксперт: '), byExpert.title);
    smoke.ok(
      'сводка по эксперту: только его экспертизы',
      byExpert.reviews.every((review) => review.expertId === expert.id),
      byExpert.reviews.map((review) => review.expertId),
    );
    smoke.eq('сводка по эксперту: тип выборки', byExpert.kind, 'expert');
    smoke.eq('итоги: число экспертиз совпадает с числом строк', byExpert.totals.reviews, byExpert.reviews.length);
    smoke.ok('итоги: экспертов в выборке — один', byExpert.totals.experts <= 1, byExpert.totals.experts);

    // Сводка по вердикту: только экспертизы с этим вердиктом.
    const verdict = await prisma.review_statuses.findFirst({
      where: { deleted_at: null },
      select: { id: true, name: true },
    });
    if (verdict) {
      const byVerdict = await buildReviewSummary(admin, { status_id: verdict.id });
      smoke.eq('сводка по вердикту: тип выборки', byVerdict.kind, 'verdict');
      smoke.ok(
        'сводка по вердикту: только этот вердикт',
        byVerdict.reviews.every((review) => review.verdictId === verdict.id),
        byVerdict.reviews.map((review) => review.verdictId),
      );
    }

    // Сводка по заявке с экспертизами: строки принадлежат ей, средние считаются.
    const application = await prisma.applications.findFirst({
      where: { deleted_at: null, application_reviews: { some: { deleted_at: null } } },
      select: { id: true, title: true },
    });
    if (application) {
      const byApplication = await buildReviewSummary(admin, { application_id: application.id });
      smoke.eq('сводка по заявке: тип выборки', byApplication.kind, 'application');
      smoke.ok(
        'сводка по заявке: строки принадлежат ей',
        byApplication.reviews.every((review) => review.applicationId === application.id),
        byApplication.reviews.map((review) => review.applicationId),
      );
      smoke.eq('сводка по заявке: заявок в итогах — одна', byApplication.totals.applications, 1);
      smoke.ok(
        'средние по критериям не выходят за границы оценок',
        byApplication.criteriaAverages.every((criterion) => criterion.averageScore >= 0),
        byApplication.criteriaAverages,
      );
    }

    // Произвольный набор: если он всё равно свёлся к одной заявке или эксперту,
    // заголовок называется по нему (это тот же документ, что и сводка по заявке).
    const sample = await prisma.application_reviews.findMany({
      where: { deleted_at: null },
      orderBy: { id: 'asc' },
      select: { id: true, application_id: true, expert_id: true },
    });
    if (sample.length > 0) {
      const byIds = await buildReviewSummary(admin, { review_ids: sample.map((review) => review.id) });
      smoke.eq('выборка по id: число строк равно числу id', byIds.reviews.length, sample.length);
      smoke.ok('выборка по id: заголовок не пустой', byIds.title.length > 0, byIds.title);

      if (sample.length > 1) {
        // Разные заявки и разные эксперты — это уже действительно «выборка».
        const manyApplications = new Set(sample.map((review) => review.application_id)).size > 1;
        const manyExperts = new Set(sample.map((review) => review.expert_id)).size > 1;
        if (manyApplications && manyExperts) {
          smoke.eq('выборка по id: тип — произвольный набор', byIds.kind, 'selection');
          smoke.ok('выборка по id: заголовок описывает набор', byIds.title.includes('Выборка'), byIds.title);
        } else {
          smoke.ok('выборка по id: сводится к одной сущности', byIds.kind !== 'selection', byIds.kind);
        }
      }
    }

    // Доступ: агрегат пересекает заявки, поэтому эксперту он недоступен.
    await smoke.fails(
      'эксперту сводка недоступна',
      () => buildReviewSummary(asExpert(expert.id, expert.email), { expert_id: expert.id }),
      'FORBIDDEN',
    );

    // Та же проверка для самого задания отчёта: угадав id, чужой PDF не получить.
    // Запись создаём напрямую, без `startReviewsExport`: тот запускает воркер и генерирует файл.
    const job = await prisma.pdf_export_jobs.create({
      data: { kind: PdfReportKinds.reviews, params: { expert_id: expert.id }, label: SMOKE_LABEL },
      select: { id: true },
    });
    jobId = job.id;
    await smoke.fails(
      'эксперт не может прочитать чужое задание сводки',
      () => getJobForUser(asExpert(expert.id, expert.email), job.id),
      'FORBIDDEN',
    );
    smoke.eq('админ видит задание сводки', (await getJobForUser(admin, job.id)).kind, PdfReportKinds.reviews);
    // Создание сводки экспертом отклоняется до появления задания (побочных эффектов нет).
    await smoke.fails(
      'эксперт не может создать задание сводки',
      () => startReviewsExport(asExpert(expert.id, expert.email), { expert_id: expert.id }, null),
      'FORBIDDEN',
    );

    // Формат ФИО: пустое имя не должно давать строку из пробелов.
    smoke.eq('ФИО собирается из частей', formatPerson({ surname: 'Иванов', name: 'Иван', patronymic: 'Иванович' }), 'Иванов Иван Иванович');
    smoke.eq(
      'пустое ФИО заменяется адресом',
      formatPerson({ surname: null, name: null, patronymic: null, email: 'user@arbuz.local' }),
      'user@arbuz.local',
    );
  } finally {
    // Задание для проверки прав убираем: воркер за ним не запускался, файл не создавался.
    if (jobId !== null) await prisma.pdf_export_jobs.delete({ where: { id: jobId } });
    await prisma.$disconnect();
  }

  smoke.done();
}

await main();
