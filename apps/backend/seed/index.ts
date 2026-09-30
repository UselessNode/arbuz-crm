// Наполнение БД тестовыми данными для разработки.
//
// Что создаётся:
//   1) администратор из ADMIN_EMAIL / ADMIN_PASSWORD (обязательно);
//   2) справочники статусов заявок и вердиктов экспертиз;
//   3) демо-данные (включаются по умолчанию; отключить — SEED_DEMO=false;
//      в NODE_ENV=production не создаются):
//      заявитель, два эксперта, конкурс с критериями и направлениями,
//      заявки в разных состояниях, публикации для ленты новостей.
//
// Значения тестовых данных — в `data.ts`, создание записей — в соседних модулях.
// Скрипт идемпотентен: повторный запуск не создаёт дубликатов.
import { RoleType } from '@arbuz/shared';
import { prisma } from '../lib/prisma';
import { log } from '../lib/logger';
import { SEED_APPLICATIONS, SEED_POSTS, SEED_TENDER, SEED_USERS, type SeedUserKey } from './data';
import { ensureApplicationStatuses, ensureReviewStatuses, type StatusMap } from './reference';
import { ensureConsentDocuments } from './consents';
import { ensureUser, resolveSeedUser } from './users';
import { ensureTender } from './tenders';
import { ensureApplication, ensureBudgetItem, ensureMember, ensurePlan } from './applications';
import { ensureReview } from './reviews';
import { ensurePost } from './posts';

/** Создаёт демо-набор: пользователи, конкурс, заявки с вложенными частями, публикации. */
async function seedDemo(statuses: StatusMap, adminId: number, reviewStatusByName: (name: string) => number): Promise<void> {
  const userIds = {} as Record<SeedUserKey, number>;
  for (const seedUser of SEED_USERS) {
    const user = await ensureUser(resolveSeedUser(seedUser));
    userIds[seedUser.key] = user.id;
  }

  const { tender, directions } = await ensureTender(SEED_TENDER);

  for (const seedApp of SEED_APPLICATIONS) {
    const application = await ensureApplication({
      ownerId: userIds[seedApp.ownerKey],
      title: seedApp.title,
      tenderId: tender.id,
      directionId: seedApp.directionIndex === null ? null : directions[seedApp.directionIndex]?.id ?? null,
      statusId: statuses[seedApp.statusKey],
      // Отправленные заявки имеют дату подачи, черновики — нет.
      submittedAt: seedApp.statusKey === 'draft' ? null : new Date(),
      idea: seedApp.idea,
      importance: seedApp.importance,
      goal: seedApp.goal,
      tasks: seedApp.tasks,
      experience: seedApp.experience,
      results: seedApp.results,
    });

    for (const member of seedApp.members ?? []) await ensureMember(application.id, member);
    for (const plan of seedApp.plans ?? []) await ensurePlan(application.id, plan);
    for (const item of seedApp.budget ?? []) await ensureBudgetItem(application.id, item);
    for (const review of seedApp.reviews ?? []) {
      await ensureReview(application.id, userIds[review.expertKey], {
        statusId: reviewStatusByName(review.statusName),
        text: review.text,
      });
    }
  }

  for (const post of SEED_POSTS) await ensurePost(post, adminId);

  log.info('seed: демо-данные готовы');
}

/** Создаёт администратора и (по умолчанию) демо-данные. */
async function main(): Promise<void> {
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminEmail || !adminPassword) {
    throw new Error('[seed] Укажите ADMIN_EMAIL и ADMIN_PASSWORD в .env (см. .env.example)');
  }

  const statuses = await ensureApplicationStatuses();
  const reviewStatusByName = await ensureReviewStatuses();
  // Документы согласий нужны всегда (без них невозможна регистрация).
  await ensureConsentDocuments();
  const admin = await ensureUser({ email: adminEmail, password: adminPassword, role: RoleType.admin });

  const demoDisabled = process.env.SEED_DEMO === 'false' || process.env.NODE_ENV === 'production';
  if (demoDisabled) {
    log.info('seed: демо-данные пропущены (SEED_DEMO=false)');
    return;
  }

  await seedDemo(statuses, admin.id, reviewStatusByName);

  log.info('seed: готово', {
    admin: admin.email,
    applicant: process.env.DEMO_EMAIL ?? 'demo@arbuz.local',
    experts: [process.env.EXPERT_EMAIL ?? 'expert@arbuz.local', process.env.EXPERT2_EMAIL ?? 'expert2@arbuz.local'],
  });
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error('[seed] Ошибка:', error);
    await prisma.$disconnect();
    process.exit(1);
  });
