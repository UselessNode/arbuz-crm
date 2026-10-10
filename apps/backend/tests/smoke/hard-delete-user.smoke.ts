// Смоук: физическое удаление пользователя со связями (все ветки).
//
//   • удаление эксперта уносит его вердикты, но не чужие заявки;
//   • удаление заявителя уносит его заявки (каскадом — состав/согласия/экспертизы);
//   • сам пользователь удаляется физически (email освобождается).
import { RoleType } from '@arbuz/shared';
import { prisma } from '../../lib/prisma';
import { createUser, hardDeleteUser } from '../../modules/users/users.service';
import { createApplication } from '../../modules/applications/applications.service';
import { assignExpert } from '../../modules/reviews/reviews.service';
import { createSmoke } from '../helpers/smoke';
import { requireAdmin } from '../helpers/actors';

const smoke = createSmoke('hard-delete-user (физическое удаление пользователя)');

async function main(): Promise<void> {
  const admin = await requireAdmin();
  const stamp = Date.now();
  let applicantId: number | null = null;
  let expertId: number | null = null;
  let applicationId: number | null = null;

  try {
    // Заявитель + его заявка.
    const applicant = await createUser(admin.id, {
      email: `smoke-applicant-${stamp}@test.local`,
      password: 'password123',
      role: RoleType.applicant,
    });
    applicantId = applicant.id;
    const application = await createApplication(admin, {
      title: '[smoke] заявка заявителя',
      idea_description: 'x',
      importance_to_team: 'x',
      project_goal: 'x',
      project_tasks: 'x',
      owner_id: applicant.id,
    });
    applicationId = application.id;

    // Эксперт + его вердикт на этой заявке.
    const expert = await createUser(admin.id, {
      email: `smoke-expert-${stamp}@test.local`,
      password: 'password123',
      role: RoleType.expert,
    });
    expertId = expert.id;
    const review = await assignExpert(admin, application.id, expert.id);

    // --- Удаление эксперта: уносит вердикты, но не заявку ---
    await hardDeleteUser(expert.id);
    expertId = null;
    const expertGone = await prisma.users.findUnique({ where: { id: expert.id }, select: { id: true } });
    smoke.ok('эксперт удалён физически', expertGone === null);
    const reviewGone = await prisma.application_reviews.findUnique({ where: { id: review.id }, select: { id: true } });
    smoke.ok('вердикты эксперта удалены вместе с ним', reviewGone === null);
    const applicationKept = await prisma.applications.findUnique({ where: { id: application.id }, select: { id: true } });
    smoke.ok('заявка не удалена при удалении эксперта', applicationKept !== null);

    // --- Удаление заявителя: уносит его заявку ---
    await hardDeleteUser(applicant.id);
    applicantId = null;
    const applicantGone = await prisma.users.findUnique({ where: { id: applicant.id }, select: { id: true } });
    smoke.ok('заявитель удалён физически', applicantGone === null);
    const applicationGone = await prisma.applications.findUnique({ where: { id: application.id }, select: { id: true } });
    smoke.ok('заявки заявителя удалены вместе с ним', applicationGone === null);
    applicationId = null;
  } finally {
    if (applicationId !== null) await prisma.applications.delete({ where: { id: applicationId } }).catch(() => undefined);
    if (applicantId !== null) await prisma.users.delete({ where: { id: applicantId } }).catch(() => undefined);
    if (expertId !== null) await prisma.users.delete({ where: { id: expertId } }).catch(() => undefined);
  }

  await prisma.$disconnect();
  smoke.done();
}

await main();
