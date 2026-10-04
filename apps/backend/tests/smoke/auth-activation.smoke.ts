// Смоук: активация аккаунтов, созданных администратором (неактивны до принятия ПС/ПДн).
import { RoleType } from '@arbuz/shared';
import { prisma } from '../../lib/prisma';
import { activateAccount } from '../../modules/auth/auth.service';
import { createUser, listExperts, listUsers } from '../../modules/users/users.service';
import { createSmoke } from '../helpers/smoke';
import { requireAdmin } from '../helpers/actors';

const smoke = createSmoke('auth (активация аккаунтов)');

const META = { ip: '203.0.113.9', userAgent: 'smoke-test/1.0' };

async function main(): Promise<void> {
  const admin = await requireAdmin();
  const stamp = Date.now();
  const applicantEmail = `smoke-inactive-applicant-${stamp}@arbuz.local`;
  const expertEmail = `smoke-inactive-expert-${stamp}@arbuz.local`;
  const adminEmail = `smoke-active-admin-${stamp}@arbuz.local`;
  const createdIds: number[] = [];

  try {
    // Созданный админом заявитель — неактивен.
    const applicant = await createUser(admin.id, {
      email: applicantEmail,
      password: 'password123',
      role: RoleType.applicant,
      surname: 'Тест',
      name: 'Неактивный',
    });
    createdIds.push(applicant.id);
    smoke.eq('аккаунт от админа создан неактивным', applicant.activatedAt, null);

    // Админ — сотрудник оператора: активен сразу, согласия не требуются.
    const adminUser = await createUser(admin.id, {
      email: adminEmail,
      password: 'password123',
      role: RoleType.admin,
    });
    createdIds.push(adminUser.id);
    smoke.ok('аккаунт администратора активен сразу', adminUser.activatedAt !== null);

    // Неактивный эксперт не предлагается для назначения.
    const expert = await createUser(admin.id, {
      email: expertEmail,
      password: 'password123',
      role: RoleType.expert,
      surname: 'Тест',
      name: 'Эксперт',
    });
    createdIds.push(expert.id);
    smoke.ok(
      'неактивный эксперт скрыт из селекта назначения',
      !(await listExperts()).some((item) => item.id === expert.id),
    );

    // Неактивные — первыми в списке пользователей.
    const list = await listUsers({ search: 'smoke-inactive', limit: 20, offset: 0 });
    smoke.ok(
      'неактивные аккаунты идут первыми',
      list.users.length > 0 && list.users.every((user) => user.activatedAt === null),
      list.users.map((user) => ({ id: user.id, activated: user.activatedAt })),
    );

    // Активация без согласий запрещена.
    await smoke.fails(
      'активация без согласий запрещена',
      () => activateAccount(applicant.id, { surname: 'Тест' }, META),
      'CONSENT_REQUIRED',
    );

    // Активация с обоими согласиями: аккаунт активен, журнал согласий заполнен.
    await activateAccount(
      applicant.id,
      { surname: 'Активирован', name: 'Тест', accept_terms: true, accept_personal_data_consent: true },
      META,
    );
    const events = await prisma.consent_events.count({ where: { user_id: applicant.id } });
    smoke.eq('активация: два события журнала согласий', events, 2);
    const activated = await prisma.users.findUnique({ where: { id: applicant.id }, select: { activated_at: true, surname: true } });
    smoke.ok('активация: проставлено время активации', activated?.activated_at !== null);
    smoke.eq('активация: сохранены правки профиля', activated?.surname, 'Активирован');

    // Повторная активация запрещена.
    await smoke.fails(
      'повторная активация запрещена',
      () => activateAccount(applicant.id, { accept_terms: true, accept_personal_data_consent: true }, META),
      'ALREADY_ACTIVATED',
    );

    // Активированный эксперт появляется в селекте назначения.
    await activateAccount(expert.id, { accept_terms: true, accept_personal_data_consent: true }, META);
    smoke.ok(
      'активированный эксперт доступен для назначения',
      (await listExperts()).some((item) => item.id === expert.id),
    );
  } finally {
    for (const id of createdIds) await prisma.users.delete({ where: { id } }).catch(() => undefined);
    await prisma.$disconnect();
  }

  smoke.done();
}

await main();
