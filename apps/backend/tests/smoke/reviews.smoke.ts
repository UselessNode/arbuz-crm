// Смоук: назначение экспертов (лимит из настроек конкурса) и приватность экспертиз.
import { RoleType } from '@arbuz/shared';
import { prisma } from '../../lib/prisma';
import { APPLICATION_STATUS_NAMES } from '../../lib/app-status';
import { assignExpert, expertsLimitForTender, listReviews } from '../../modules/reviews/reviews.service';
import { createSmoke } from '../helpers/smoke';
import { asExpert, requireAdmin } from '../helpers/actors';

const smoke = createSmoke('reviews (лимит экспертов и приватность)');

/** Временная заявка для проверки лимита назначений. */
async function createTempApplication(adminId: number, tenderId: number): Promise<number> {
  const status = await prisma.application_statuses.findFirst({
    where: { name: APPLICATION_STATUS_NAMES.draft, deleted_at: null },
    select: { id: true },
  });
  if (!status) throw new Error('[smoke] Нет статуса «Черновик» — выполните `bun seed`');

  const application = await prisma.applications.create({
    data: {
      owner_id: adminId,
      title: `[smoke] Заявка ${Date.now()}`,
      tender_id: tenderId,
      status_id: status.id,
      idea_description: 'Проверка лимита экспертов',
      importance_to_team: 'Проверка',
      project_goal: 'Проверка',
      project_tasks: 'Проверка',
    },
    select: { id: true },
  });
  return application.id;
}

async function main(): Promise<void> {
  const admin = await requireAdmin();
  let applicationId: number | null = null;
  let repeatApplicationId: number | null = null;
  let tempExpertId: number | null = null;

  try {
    const tender = await prisma.tenders.findFirst({
      where: { deleted_at: null, experts_count: { gt: 0 } },
      select: { id: true, experts_count: true },
    });
    if (!tender) throw new Error('[smoke] В dev-базе нет конкурса — выполните `bun seed`');

    smoke.eq('лимит экспертов берётся из настроек конкурса', await expertsLimitForTender(tender.id), tender.experts_count);

    const experts = await prisma.users.findMany({
      where: { role: RoleType.expert, deleted_at: null },
      select: { id: true, email: true },
      take: tender.experts_count + 1,
    });
    smoke.ok('в dev-базе есть эксперты', experts.length > 0, { found: experts.length });

    // Приватность: эксперт видит только свои экспертизы, администратор — все.
    const firstExpert = experts[0];
    const expertView = await listReviews(asExpert(firstExpert.id, firstExpert.email));
    smoke.ok(
      'эксперт видит только свои экспертизы',
      expertView.every((review) => review.expert?.id === firstExpert.id),
      expertView.map((review) => review.expert?.id),
    );
    const adminView = await listReviews(admin);
    smoke.ok('администратор видит все экспертизы', adminView.length >= expertView.length, {
      admin: adminView.length,
      expert: expertView.length,
    });

    // Лимит: N экспертов назначаются, (N+1)-й — отклоняется.
    const newApplicationId = await createTempApplication(admin.id, tender.id);
    applicationId = newApplicationId;
    for (let index = 0; index < tender.experts_count; index += 1) {
      await assignExpert(admin, newApplicationId, experts[index].id);
    }
    smoke.eq(
      'назначено ровно N экспертов',
      await prisma.application_reviews.count({ where: { application_id: newApplicationId, deleted_at: null } }),
      tender.experts_count,
    );

    const extra = experts[tender.experts_count];
    if (extra) {
      await smoke.fails(
        'превышение лимита экспертов отклоняется',
        () => assignExpert(admin, newApplicationId, extra.id),
        'EXPERT_LIMIT_REACHED',
      );
    } else {
      // Запасного эксперта нет — создаём временного и удаляем его после проверки.
      const tempExpert = (
        await prisma.users.create({
          data: {
            email: `smoke-expert-${Date.now()}@arbuz.local`,
            password_hash: 'smoke',
            role: RoleType.expert,
            name: 'Смоук',
            surname: 'Эксперт',
          },
          select: { id: true },
        })
      ).id;
      tempExpertId = tempExpert;
      await smoke.fails(
        'превышение лимита экспертов отклоняется',
        () => assignExpert(admin, newApplicationId, tempExpert),
        'EXPERT_LIMIT_REACHED',
      );
    }
    // Повторное назначение после снятия: soft-deleted экспертиза не должна ломать create
    // (уникальный индекс (application_id, expert_id) не учитывает deleted_at).
    const repeatId = await createTempApplication(admin.id, tender.id);
    repeatApplicationId = repeatId;
    const reassigned = await assignExpert(admin, repeatId, firstExpert.id);
    await prisma.application_reviews.update({ where: { id: reassigned.id }, data: { deleted_at: new Date() } });
    await assignExpert(admin, repeatId, firstExpert.id);
    smoke.eq(
      'повторное назначение после снятия даёт ровно одну активную экспертизу',
      await prisma.application_reviews.count({ where: { application_id: repeatId, deleted_at: null } }),
      1,
    );
  } finally {
    if (applicationId !== null) await prisma.applications.delete({ where: { id: applicationId } });
    if (repeatApplicationId !== null) await prisma.applications.delete({ where: { id: repeatApplicationId } });
    if (tempExpertId !== null) await prisma.users.delete({ where: { id: tempExpertId } });
    await prisma.$disconnect();
  }

  smoke.done();
}

await main();
