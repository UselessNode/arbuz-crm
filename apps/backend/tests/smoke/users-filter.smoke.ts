// Смоук: фильтры списка пользователей (диапазоны даты создания, активности, числа заявок).
import { RoleType } from '@arbuz/shared';
import { prisma } from '../../lib/prisma';
import { createUser, listUsers } from '../../modules/users/users.service';
import { createSmoke } from '../helpers/smoke';
import { requireAdmin } from '../helpers/actors';

const smoke = createSmoke('users (фильтры списка)');
const DAY = 24 * 60 * 60 * 1000;

async function main(): Promise<void> {
  const admin = await requireAdmin();
  const stamp = Date.now();
  const email = `smoke-filter-${stamp}@arbuz.local`;
  let userId: number | null = null;

  try {
    const user = await createUser(admin.id, { email, password: 'password123', role: RoleType.applicant });
    userId = user.id;
    smoke.eq('новый пользователь: заявок 0', user.applicationsCount, 0);

    // Мультивыбор ролей: заявитель входит, администратор — нет.
    const onlyApplicants = await listUsers({ search: email, roles: [RoleType.applicant], limit: 20, offset: 0 });
    smoke.ok('roles=[applicant] включает заявителя', onlyApplicants.users.some((row) => row.id === userId));
    const onlyAdmins = await listUsers({ search: email, roles: [RoleType.admin], limit: 20, offset: 0 });
    smoke.ok('roles=[admin] исключает заявителя', !onlyAdmins.users.some((row) => row.id === userId));

    // Статус аккаунта: созданный админом пользователь не активирован.
    const inactive = await listUsers({ search: email, activated: false, limit: 20, offset: 0 });
    smoke.ok('activated=false включает неактивированного', inactive.users.some((row) => row.id === userId));
    const active = await listUsers({ search: email, activated: true, limit: 20, offset: 0 });
    smoke.ok('activated=true исключает неактивированного', !active.users.some((row) => row.id === userId));

    const found = await listUsers({ search: email, limit: 20, offset: 0 });
    smoke.ok('поиск по email находит пользователя', found.users.some((row) => row.id === userId));

    const past = new Date(Date.now() - DAY);
    const future = new Date(Date.now() + DAY);

    const createdAfterPast = await listUsers({ search: email, created: { gte: past }, limit: 20, offset: 0 });
    smoke.ok('создан после вчера — найден', createdAfterPast.users.some((row) => row.id === userId));

    const createdAfterFuture = await listUsers({ search: email, created: { gte: future }, limit: 20, offset: 0 });
    smoke.ok('создан не позже завтра — отфильтрован', !createdAfterFuture.users.some((row) => row.id === userId));

    const activeBeforePast = await listUsers({ search: email, activity: { lte: past }, limit: 20, offset: 0 });
    smoke.ok('активность раньше вчера — отфильтрован', !activeBeforePast.users.some((row) => row.id === userId));

    const activeAfterPast = await listUsers({ search: email, activity: { gte: past }, limit: 20, offset: 0 });
    smoke.ok('активность после вчера — найден', activeAfterPast.users.some((row) => row.id === userId));

    const zeroApps = await listUsers({ search: email, apps: { min: 0, max: 0 }, limit: 20, offset: 0 });
    smoke.ok('диапазон заявок 0..0 включает пользователя без заявок', zeroApps.users.some((row) => row.id === userId));

    const onePlusApps = await listUsers({ search: email, apps: { min: 1 }, limit: 20, offset: 0 });
    smoke.ok('диапазон заявок ≥1 исключает пользователя без заявок', !onePlusApps.users.some((row) => row.id === userId));
  } finally {
    if (userId !== null) await prisma.users.delete({ where: { id: userId } }).catch(() => undefined);
    await prisma.notifications.deleteMany({ where: { body: { contains: email } } }).catch(() => undefined);
    await prisma.$disconnect();
  }

  smoke.done();
}

await main();
