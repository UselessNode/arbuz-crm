// Смоук: права на редактирование заявки по ролям.
//
// После отправки на проверку заявку редактирует только администратор; владелец-заявитель — нет.
// Эксперт не редактирует заявку никогда. Проверяем через `getApplicationForAccess` (режим 'edit').
import { RoleType } from '@arbuz/shared';
import { prisma } from '../../lib/prisma';
import { getApplicationForAccess } from '../../modules/applications/applications.service';
import { createSmoke } from '../helpers/smoke';
import { asExpert, requireAdmin } from '../helpers/actors';
import type { CurrentUser } from '../../modules/files/files.service';

const smoke = createSmoke('application-access (права на редактирование заявки)');

async function main(): Promise<void> {
  const admin = await requireAdmin();

  const draft = await prisma.applications.findFirst({
    where: { deleted_at: null, submitted_at: null, users: { role: RoleType.applicant } },
    select: { id: true, users: { select: { id: true, email: true, role: true } } },
    orderBy: { id: 'asc' },
  });
  const submitted = await prisma.applications.findFirst({
    where: { deleted_at: null, submitted_at: { not: null }, users: { role: RoleType.applicant } },
    select: { id: true, users: { select: { id: true, email: true, role: true } } },
    orderBy: { id: 'asc' },
  });

  if (draft?.users) {
    const owner: CurrentUser = draft.users;
    await getApplicationForAccess(owner, draft.id, 'edit');
    smoke.ok('владелец может редактировать черновик', true);
  } else {
    smoke.ok('есть черновик заявителя', false, 'выполните `bun seed`');
  }

  if (submitted?.users) {
    const owner: CurrentUser = submitted.users;
    await smoke.fails(
      'владелец не может редактировать отправленную заявку',
      () => getApplicationForAccess(owner, submitted.id, 'edit'),
      'APPLICATION_NOT_EDITABLE',
    );
    await smoke.fails(
      'эксперт не может редактировать заявку',
      () => getApplicationForAccess(asExpert(admin.id, admin.email), submitted.id, 'edit'),
      'APPLICATION_NOT_EDITABLE',
    );
    await getApplicationForAccess(admin, submitted.id, 'edit');
    smoke.ok('администратор может редактировать отправленную заявку', true);
  } else {
    smoke.ok('есть отправленная заявка заявителя', false, 'выполните `bun seed`');
  }

  smoke.done();
}

main();
