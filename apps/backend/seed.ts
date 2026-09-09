// Начальное наполнение БД для разработки:
//  1) администратор из env ADMIN_EMAIL / ADMIN_PASSWORD (обязательно);
//  2) при SEED_DEMO=true — демо-заявитель, демо-заявка и участник команды
//     (чтобы можно было проверить загрузку файлов и согласий).
import { RoleType } from '@arbuz/shared';
import { prisma } from './lib/prisma';
import { hashPassword } from './modules/auth/auth.service';
import { log } from './lib/logger';

async function ensureStatuses(): Promise<void> {
  const count = await prisma.application_statuses.count();
  if (count > 0) return;
  await prisma.application_statuses.createMany({
    data: [
      { name: 'Черновик', is_editable: true, is_deletable: true, description: 'Заявка создаётся, ещё не отправлена' },
      { name: 'На проверке', is_editable: false, is_deletable: false, description: 'Заявка отправлена экспертам' },
      { name: 'Принята', is_editable: false, is_deletable: false, description: 'Заявка одобрена' },
      { name: 'Отклонена', is_editable: false, is_deletable: false, description: 'Заявка отклонена' },
    ],
  });
  log.info('seed: созданы статусы заявок');
}

async function ensureUser(email: string, password: string, role: RoleType) {
  const existing = await prisma.users.findUnique({ where: { email } });
  if (existing) {
    log.info('seed: пользователь уже существует', { email, role });
    return existing;
  }
  const passwordHash = await hashPassword(password);
  const user = await prisma.users.create({ data: { email, password_hash: passwordHash, role } });
  log.info('seed: создан пользователь', { id: user.id, email, role });
  return user;
}

async function main(): Promise<void> {
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminEmail || !adminPassword) {
    throw new Error('[seed] Укажите ADMIN_EMAIL и ADMIN_PASSWORD в .env (см. .env.example)');
  }

  await ensureStatuses();
  const admin = await ensureUser(adminEmail, adminPassword, RoleType.admin);

  if (process.env.SEED_DEMO !== 'true') {
    log.info('seed: демо-данные пропущены (SEED_DEMO=true для создания)');
    return;
  }

  const demoEmail = process.env.DEMO_EMAIL ?? 'demo@arbuz.local';
  const demoPassword = process.env.DEMO_PASSWORD ?? 'demo12345';
  const applicant = await ensureUser(demoEmail, demoPassword, RoleType.applicant);

  const existingApp = await prisma.applications.findFirst({
    where: { owner_id: applicant.id },
    select: { id: true },
  });
  let application;
  if (existingApp) {
    application = await prisma.applications.findUnique({ where: { id: existingApp.id } });
    log.info('seed: демо-заявка уже существует', { id: application?.id });
  } else {
    application = await prisma.applications.create({
      data: {
        owner_id: applicant.id,
        title: 'Демо-заявка',
        status_id: 1,
        idea_description: 'Описание идеи (демо).',
        importance_to_team: 'Значимость для команды (демо).',
        project_goal: 'Цель проекта (демо).',
        project_tasks: 'Задачи проекта (демо).',
      },
    });
    log.info('seed: создана демо-заявка', { id: application.id });
  }

  if (!application) throw new Error('[seed] Не удалось получить демо-заявку');
  const memberCount = await prisma.team_members.count({ where: { application_id: application.id } });
  if (memberCount === 0) {
    const member = await prisma.team_members.create({
      data: {
        application_id: application.id,
        surname: 'Иванов',
        name: 'Иван',
        consent_file_path: '',
      },
    });
    log.info('seed: создан демо-участник команды', { id: member.id, applicationId: application.id });
  } else {
    log.info('seed: демо-участник уже существует');
  }

  log.info('seed: готово. Админ:', { email: admin.email });
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error('[seed] Ошибка:', error);
    await prisma.$disconnect();
    process.exit(1);
  });
