// Смоук: серверные фильтры и сортировка списочных эндпоинтов (заявки, экспертизы, публикации).
import { PostStatus } from '@arbuz/shared';
import { prisma } from '../../lib/prisma';
import { listApplications } from '../../modules/applications/applications.service';
import { listReviews } from '../../modules/reviews/reviews.service';
import { listPostsForAdmin } from '../../modules/posts/posts.service';
import { createSmoke } from '../helpers/smoke';
import { requireAdmin } from '../helpers/actors';

const smoke = createSmoke('list (серверные фильтры и сортировка)');
const DAY = 24 * 60 * 60 * 1000;

async function main(): Promise<void> {
  const admin = await requireAdmin();
  const future = new Date(Date.now() + DAY);

  try {
    // --- Заявки ---
    const application = await prisma.applications.findFirst({
      where: { deleted_at: null },
      select: { id: true, status_id: true },
    });
    if (!application) throw new Error('[smoke] В dev-базе нет заявок — выполните `bun seed`');

    const byStatus = await listApplications(admin, { statusIds: [application.status_id], limit: 100, offset: 0 });
    const statusRows = byStatus.applications as Array<{ statusId: number }>;
    smoke.ok(
      'заявки: statusIds отдаёт только выбранный статус',
      statusRows.length > 0 && statusRows.every((row) => row.statusId === application.status_id),
    );

    const byId = await listApplications(admin, { applicationIds: [application.id], limit: 100, offset: 0 });
    smoke.eq('заявки: applicationIds ограничивает до одной', byId.applications.length, 1);

    const createdFuture = await listApplications(admin, { created: { gte: future }, limit: 100, offset: 0 });
    smoke.eq('заявки: дата создания в будущем — пусто', createdFuture.total, 0);

    const sorted = await listApplications(admin, {
      sort: { field: 'created_at', direction: 'asc' },
      limit: 100,
      offset: 0,
    });
    const times = (sorted.applications as Array<{ createdAt: string }>).map((row) => new Date(row.createdAt).getTime());
    smoke.ok('заявки: сортировка created_at возрастает', times.every((value, index) => index === 0 || times[index - 1] <= value));

    // --- Экспертизы ---
    const review = await prisma.application_reviews.findFirst({
      where: { deleted_at: null },
      select: { application_id: true, expert_id: true },
    });
    if (!review) throw new Error('[smoke] В dev-базе нет экспертиз — выполните `bun seed`');

    const byApplication = await listReviews(admin, { applicationIds: [review.application_id], limit: 100, offset: 0 });
    smoke.ok(
      'экспертизы: applicationIds отдаёт только выбранную заявку',
      byApplication.reviews.length > 0 && byApplication.reviews.every((row) => row.applicationId === review.application_id),
    );

    const byExpert = await listReviews(admin, { expertIds: [review.expert_id], limit: 100, offset: 0 });
    smoke.ok(
      'экспертизы: expertIds отдаёт только выбранного эксперта',
      byExpert.reviews.length > 0 && byExpert.reviews.every((row) => row.expert?.id === review.expert_id),
    );

    const unreachableScore = await listReviews(admin, { score: { min: 1_000_000 }, limit: 100, offset: 0 });
    smoke.eq('экспертизы: недостижимый балл — пусто', unreachableScore.total, 0);

    // --- Публикации ---
    const createdFuturePosts = await listPostsForAdmin(admin, { limit: 100, offset: 0, created: { gte: future } });
    smoke.eq('публикации: дата создания в будущем — пусто', createdFuturePosts.total, 0);

    const published = await listPostsForAdmin(admin, { limit: 100, offset: 0, statuses: [PostStatus.published] });
    smoke.ok(
      'публикации: statuses=[published] отдаёт только опубликованные',
      published.posts.every((post) => post.status === PostStatus.published),
    );
  } finally {
    await prisma.$disconnect();
  }

  smoke.done();
}

await main();
