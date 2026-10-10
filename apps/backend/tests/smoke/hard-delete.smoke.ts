// Смоук: физическое (жёсткое) удаление сущностей.
//
// Проверяем, что удаление не оставляет строк (soft-delete больше не используется):
//   • заявка удаляется физически;
//   • экспертиза удаляется физически, а повторное назначение после этого работает;
//   • регион без пользователей удаляется физически, а занятый — блокируется.
import { RoleType } from '@arbuz/shared';
import { prisma } from '../../lib/prisma';
import { createApplication, deleteApplication } from '../../modules/applications/applications.service';
import { assignExpert, deleteReview } from '../../modules/reviews/reviews.service';
import { createRegion, deleteRegion } from '../../modules/regions/regions.service';
import { createSmoke } from '../helpers/smoke';
import { requireAdmin } from '../helpers/actors';

const smoke = createSmoke('hard-delete (физическое удаление)');

async function main(): Promise<void> {
  const admin = await requireAdmin();
  let applicationId: number | null = null;

  try {
    // --- Заявка ---
    const application = await createApplication(admin, {
      title: '[smoke] заявка на удаление',
      idea_description: 'x',
      importance_to_team: 'x',
      project_goal: 'x',
      project_tasks: 'x',
    });
    applicationId = application.id;

    // --- Экспертиза: удаляется физически, повторное назначение работает ---
    const expert = await prisma.users.findFirst({
      where: { role: RoleType.expert, deleted_at: null },
      select: { id: true },
    });
    if (expert) {
      const review = await assignExpert(admin, applicationId, expert.id);
      await deleteReview(admin, review.id);
      const reviewGone = await prisma.application_reviews.findUnique({
        where: { id: review.id },
        select: { id: true },
      });
      smoke.ok('экспертиза удалена физически', reviewGone === null);

      const again = await assignExpert(admin, applicationId, expert.id);
      smoke.ok('повторное назначение эксперта после удаления экспертизы', again.id !== review.id);
      await deleteReview(admin, again.id);
    } else {
      smoke.ok('есть эксперт для проверки экспертизы', false, 'выполните `bun seed`');
    }

    // --- Заявка: удаляется физически ---
    await deleteApplication(admin, applicationId);
    const applicationGone = await prisma.applications.findUnique({
      where: { id: applicationId },
      select: { id: true },
    });
    smoke.ok('заявка удалена физически', applicationGone === null);
    applicationId = null;
  } finally {
    if (applicationId !== null) {
      await prisma.applications.delete({ where: { id: applicationId } }).catch(() => undefined);
    }
  }

  // --- Регион ---
  const region = await createRegion({ name: `[smoke] регион ${Date.now()}` });
  await deleteRegion(region.id);
  const regionGone = await prisma.regions.findUnique({ where: { id: region.id }, select: { id: true } });
  smoke.ok('регион удалён физически', regionGone === null);

  const usedRegion = await prisma.regions.findFirst({ where: { users: { some: {} } }, select: { id: true } });
  if (usedRegion) {
    await smoke.fails('занятый регион не удаляется', () => deleteRegion(usedRegion.id), 'REGION_IN_USE');
  }

  await prisma.$disconnect();
  smoke.done();
}

await main();
