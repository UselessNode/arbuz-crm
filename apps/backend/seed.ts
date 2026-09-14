// Наполнение БД тестовыми данными для разработки.
//
// Что создаётся:
//   1) администратор из ADMIN_EMAIL / ADMIN_PASSWORD (обязательно);
//   2) справочник статусов заявок;
//   3) демо-данные (включаются по умолчанию; отключить — SEED_DEMO=false;
//      в NODE_ENV=production не создаются):
//      заявитель, два эксперта, конкурс с критериями и направлениями,
//      заявки в разных состояниях, публикации для ленты новостей.
//
// Скрипт идемпотентен: повторный запуск не создаёт дубликатов.
import { RoleType } from '@arbuz/shared';
import { prisma } from './lib/prisma';
import { hashPassword } from './modules/auth/auth.service';
import { log } from './lib/logger';
import { APPLICATION_STATUS_NAMES } from './lib/app-status';

type StatusMap = Record<'draft' | 'submitted' | 'accepted' | 'rejected', number>;

/** Базовые вердикты экспертиз (редактируемый справочник). */
const REVIEW_STATUS_SEED = [
  { name: 'На экспертизе', tone: 'gray', is_default: true, description: 'Экспертиза начата, вердикт ещё не выставлен' },
  { name: 'Рекомендую поддержать', tone: 'green', is_default: false, description: 'Эксперт рекомендует поддержать заявку' },
  { name: 'Не рекомендую поддержать', tone: 'red', is_default: false, description: 'Эксперт не рекомендует поддержку заявки' },
] as const;

/** Создаёт базовые вердикты (если их нет) и возвращает их идентификаторы по названию. */
async function ensureReviewStatuses(): Promise<(name: string) => number> {
  const existing = await prisma.review_statuses.findFirst({ select: { id: true } });
  if (!existing) {
    await prisma.review_statuses.createMany({ data: REVIEW_STATUS_SEED.map((row) => ({ ...row })) });
    log.info('seed: созданы вердикты экспертиз');
  }

  const rows = await prisma.review_statuses.findMany({ where: { deleted_at: null }, select: { id: true, name: true } });
  return (name: string) => {
    const status = rows.find((row) => row.name === name);
    if (!status) throw new Error(`[seed] Вердикт «${name}» не найден в справочнике`);
    return status.id;
  };
}

/** Создаёт базовые статусы (если их нет) и возвращает их идентификаторы. */
async function ensureStatuses(): Promise<StatusMap> {
  const existing = await prisma.application_statuses.findFirst({ select: { id: true } });
  if (!existing) {
    await prisma.application_statuses.createMany({
      data: [
        { name: APPLICATION_STATUS_NAMES.draft, is_editable: true, is_deletable: true, description: 'Заявка создаётся, ещё не отправлена' },
        { name: APPLICATION_STATUS_NAMES.submitted, is_editable: false, is_deletable: false, description: 'Заявка отправлена экспертам' },
        { name: 'Принята', is_editable: false, is_deletable: false, description: 'Заявка одобрена' },
        { name: 'Отклонена', is_editable: false, is_deletable: false, description: 'Заявка отклонена' },
      ],
    });
    log.info('seed: созданы статусы заявок');
  }

  const rows = await prisma.application_statuses.findMany({ where: { deleted_at: null } });
  const byName = (name: string) => {
    const status = rows.find((row) => row.name === name);
    if (!status) throw new Error(`[seed] Статус «${name}» не найден в справочнике`);
    return status.id;
  };
  return {
    draft: byName(APPLICATION_STATUS_NAMES.draft),
    submitted: byName(APPLICATION_STATUS_NAMES.submitted),
    accepted: byName('Принята'),
    rejected: byName('Отклонена'),
  };
}

interface UserInput {
  email: string;
  password: string;
  role: RoleType;
  surname?: string;
  name?: string;
  patronymic?: string;
}

async function ensureUser(input: UserInput) {
  const email = input.email.trim().toLowerCase();
  const existing = await prisma.users.findUnique({ where: { email } });
  if (existing) {
    log.info('seed: пользователь уже существует', { email, role: input.role });
    return existing;
  }
  const user = await prisma.users.create({
    data: {
      email,
      password_hash: await hashPassword(input.password),
      role: input.role,
      surname: input.surname ?? null,
      name: input.name ?? null,
      patronymic: input.patronymic ?? null,
    },
  });
  log.info('seed: создан пользователь', { id: user.id, email, role: input.role });
  return user;
}

interface TenderInput {
  name: string;
  description: string;
  expertsCount: number;
  criteria: Array<{ name: string; description: string; min: number; max: number; weight: number }>;
  directions: Array<{ name: string; description: string }>;
}

async function ensureTender(input: TenderInput) {
  let tender = await prisma.tenders.findFirst({ where: { name: input.name, deleted_at: null } });
  if (!tender) {
    tender = await prisma.tenders.create({
      data: { name: input.name, description: input.description, experts_count: input.expertsCount },
    });
    log.info('seed: создан конкурс', { id: tender.id, name: tender.name });
  }

  for (const criterion of input.criteria) {
    const exists = await prisma.evaluation_criteria.findFirst({
      where: { tender_id: tender.id, name: criterion.name, deleted_at: null },
      select: { id: true },
    });
    if (exists) continue;
    await prisma.evaluation_criteria.create({
      data: {
        tender_id: tender.id,
        name: criterion.name,
        description: criterion.description,
        min_value: criterion.min,
        max_value: criterion.max,
        weight: criterion.weight,
      },
    });
  }

  const directions = [];
  for (const direction of input.directions) {
    let row = await prisma.directions.findFirst({
      where: { tender_id: tender.id, name: direction.name, deleted_at: null },
    });
    if (!row) {
      row = await prisma.directions.create({
        data: { tender_id: tender.id, name: direction.name, description: direction.description },
      });
    }
    directions.push(row);
  }

  log.info('seed: конкурс готов', {
    id: tender.id,
    criteria: input.criteria.length,
    directions: directions.length,
    expertsCount: input.expertsCount,
  });
  return { tender, directions };
}

interface ApplicationInput {
  ownerId: number;
  title: string;
  tenderId: number | null;
  directionId: number | null;
  statusId: number;
  submittedAt?: Date | null;
  idea: string;
  importance: string;
  goal: string;
  tasks: string;
  experience?: string;
  results?: string;
}

async function ensureApplication(input: ApplicationInput) {
  const existing = await prisma.applications.findFirst({
    where: { owner_id: input.ownerId, title: input.title },
  });
  if (existing) {
    log.info('seed: заявка уже существует', { id: existing.id, title: existing.title });
    return existing;
  }
  const application = await prisma.applications.create({
    data: {
      owner_id: input.ownerId,
      title: input.title,
      tender_id: input.tenderId,
      direction_id: input.directionId,
      status_id: input.statusId,
      submitted_at: input.submittedAt ?? null,
      idea_description: input.idea,
      importance_to_team: input.importance,
      project_goal: input.goal,
      project_tasks: input.tasks,
      implementation_experience: input.experience ?? null,
      results_description: input.results ?? null,
    },
  });
  log.info('seed: создана заявка', { id: application.id, title: application.title });
  return application;
}

async function ensureMember(
  applicationId: number,
  member: {
    surname: string;
    name: string;
    patronymic?: string;
    tasks: string;
    isCoordinator?: boolean;
    isResponsible?: boolean;
  },
) {
  const existing = await prisma.team_members.findFirst({
    where: { application_id: applicationId, surname: member.surname, name: member.name, deleted_at: null },
    select: { id: true },
  });
  if (existing) return;
  await prisma.team_members.create({
    data: {
      application_id: applicationId,
      surname: member.surname,
      name: member.name,
      patronymic: member.patronymic ?? null,
      tasks_in_project: member.tasks,
      is_coordinator: member.isCoordinator ?? false,
      is_responsible: member.isResponsible ?? false,
      is_adult: true,
      contact_info: 'demo@arbuz.local',
      // Файл согласия загружается вручную (в БД хранится путь к реальному файлу).
      consent_file_path: '',
    },
  });
}

async function ensurePlan(applicationId: number, plan: { task: string; event: string; description: string; start: string; end: string }) {
  const existing = await prisma.project_plans.findFirst({
    where: { application_id: applicationId, event_name: plan.event, deleted_at: null },
    select: { id: true },
  });
  if (existing) return;
  await prisma.project_plans.create({
    data: {
      application_id: applicationId,
      task: plan.task,
      event_name: plan.event,
      event_description: plan.description,
      start_date: new Date(plan.start),
      end_date: new Date(plan.end),
    },
  });
}

async function ensureBudgetItem(
  applicationId: number,
  item: { resource: string; quantity: number; unitCost: number; own: number; grant: number; comment?: string },
) {
  const existing = await prisma.project_budget.findFirst({
    where: { application_id: applicationId, resource_type: item.resource, deleted_at: null },
    select: { id: true },
  });
  if (existing) return;
  await prisma.project_budget.create({
    data: {
      application_id: applicationId,
      resource_type: item.resource,
      quantity: item.quantity,
      unit_cost: item.unitCost,
      own_funds: item.own,
      grant_funds: item.grant,
      comment: item.comment ?? null,
    },
  });
}

interface ReviewSeed {
  statusId: number;
  text?: string;
}

async function ensureReview(applicationId: number, expertId: number, seed: ReviewSeed) {
  const existing = await prisma.application_reviews.findFirst({
    where: { application_id: applicationId, expert_id: expertId },
    select: { id: true },
  });
  if (existing) return;
  await prisma.application_reviews.create({
    data: {
      application_id: applicationId,
      expert_id: expertId,
      status_id: seed.statusId,
      review_text: seed.text ?? null,
    },
  });
}

async function ensurePost(
  title: string,
  content: string,
  published: boolean,
  authorId: number,
  hideAuthor = false,
) {
  const existing = await prisma.posts.findFirst({ where: { title, deleted_at: null }, select: { id: true } });
  if (existing) return;
  await prisma.posts.create({
    data: { title, content, is_published: published, hide_author: hideAuthor, created_by: authorId },
  });
}

async function seedDemo(statuses: StatusMap, adminId: number, reviewStatusByName: (name: string) => number): Promise<void> {
  const applicant = await ensureUser({
    email: process.env.DEMO_EMAIL ?? 'demo@arbuz.local',
    password: process.env.DEMO_PASSWORD ?? 'demo12345',
    role: RoleType.applicant,
    surname: 'Смирнова',
    name: 'Анна',
    patronymic: 'Петровна',
  });
  const expert1 = await ensureUser({
    email: process.env.EXPERT_EMAIL ?? 'expert@arbuz.local',
    password: process.env.EXPERT_PASSWORD ?? 'expert12345',
    role: RoleType.expert,
    surname: 'Кузнецов',
    name: 'Дмитрий',
    patronymic: 'Сергеевич',
  });
  const expert2 = await ensureUser({
    email: process.env.EXPERT2_EMAIL ?? 'expert2@arbuz.local',
    password: process.env.EXPERT2_PASSWORD ?? 'expert12345',
    role: RoleType.expert,
    surname: 'Волкова',
    name: 'Елена',
    patronymic: 'Андреевна',
  });

  const { tender, directions } = await ensureTender({
    name: '2026 — Экологические инициативы',
    description: 'Сезон подачи заявок на экологические проекты НКО',
    expertsCount: 2,
    criteria: [
      { name: 'Актуальность', description: 'Важность проблемы для сообщества', min: 0, max: 10, weight: 1 },
      { name: 'Проработанность плана', description: 'Детализация мероприятий и сроков', min: 0, max: 10, weight: 1.5 },
      { name: 'Реализуемость бюджета', description: 'Обоснованность расходов', min: 0, max: 10, weight: 1 },
      { name: 'Вовлечённость сообщества', description: 'Число участников и партнёров', min: 0, max: 10, weight: 0.5 },
    ],
    directions: [
      { name: 'Экология города', description: 'Благоустройство и озеленение' },
      { name: 'Экологическое просвещение', description: 'Образовательные проекты' },
    ],
  });

  // 1. Черновик с заполненным составом (без согласий — демонстрирует диалог при отправке).
  const draft = await ensureApplication({
    ownerId: applicant.id,
    title: 'Чистые берега',
    tenderId: tender.id,
    directionId: directions[0]?.id ?? null,
    statusId: statuses.draft,
    idea: 'Организовать серию субботников на берегах городских водоёмов с раздельным сбором мусора.',
    importance: 'Загрязнение берегов влияет на качество воды и отдых горожан.',
    goal: 'Очистить 5 км береговой линии и вовлечь 100 волонтёров.',
    tasks: 'Подготовить инвентарь, провести 4 субботника, организовать вывоз и переработку отходов.',
    experience: 'В 2025 году провели 2 субботника с участием 60 человек.',
    results: '5 км чистых берегов, 100 волонтёров, 2 тонны собранного мусора.',
  });
  await ensureMember(draft.id, {
    surname: 'Смирнова',
    name: 'Анна',
    patronymic: 'Петровна',
    tasks: 'Координация проекта и работа с волонтёрами',
    isCoordinator: true,
  });
  await ensureMember(draft.id, {
    surname: 'Петров',
    name: 'Алексей',
    tasks: 'Логистика и вывоз отходов',
    isResponsible: true,
  });
  await ensurePlan(draft.id, {
    task: 'Провести субботники',
    event: 'Субботник «Чистый берег»',
    description: 'Уборка берега с раздельным сбором отходов',
    start: '2026-04-15',
    end: '2026-04-15',
  });
  await ensurePlan(draft.id, {
    task: 'Организовать переработку',
    event: 'Передача отходов на переработку',
    description: 'Сортировка и передача вторсырья партнёру',
    start: '2026-04-20',
    end: '2026-04-22',
  });
  await ensureBudgetItem(draft.id, { resource: 'Инвентарь (перчатки, мешки)', quantity: 100, unitCost: 150, own: 5000, grant: 10000 });
  await ensureBudgetItem(draft.id, { resource: 'Вывоз и переработка отходов', quantity: 2, unitCost: 12000, own: 0, grant: 24000 });
  await ensureBudgetItem(draft.id, { resource: 'Питание волонтёров', quantity: 100, unitCost: 300, own: 10000, grant: 20000 });

  // 2. Отправленная заявка с двумя назначенными экспертами (для проверки экспертизы).
  const submitted = await ensureApplication({
    ownerId: applicant.id,
    title: 'Школьный экомузей',
    tenderId: tender.id,
    directionId: directions[1]?.id ?? null,
    statusId: statuses.submitted,
    submittedAt: new Date(),
    idea: 'Создать в школе экспозицию о переработке отходов и провести цикл занятий.',
    importance: 'Экологическое просвещение школьников формирует привычки на всю жизнь.',
    goal: 'Открыть музей и провести 10 занятий для 250 учеников.',
    tasks: 'Собрать экспонаты, оформить зал, обучить экскурсоводов, провести занятия.',
    results: 'Действующий музей и 250 обученных школьников.',
  });
  await ensureMember(submitted.id, {
    surname: 'Смирнова',
    name: 'Анна',
    patronymic: 'Петровна',
    tasks: 'Координация и взаимодействие со школой',
    isCoordinator: true,
  });
  await ensurePlan(submitted.id, {
    task: 'Открыть экспозицию',
    event: 'Открытие экомузея',
    description: 'Торжественное открытие и первая экскурсия',
    start: '2026-09-10',
    end: '2026-09-10',
  });
  await ensureBudgetItem(submitted.id, { resource: 'Витрины и стенды', quantity: 6, unitCost: 8000, own: 10000, grant: 38000 });
  await ensureBudgetItem(submitted.id, { resource: 'Полиграфия для занятий', quantity: 250, unitCost: 120, own: 0, grant: 30000 });
  await ensureReview(submitted.id, expert1.id, {
    statusId: reviewStatusByName('Рекомендую поддержать'),
    text: 'Проект решает актуальную задачу, план и бюджет реалистичны, команда имеет опыт.',
  });
  await ensureReview(submitted.id, expert2.id, { statusId: reviewStatusByName('На экспертизе') });

  // 3. Пустой черновик — демонстрация пустых состояний и подсказок.
  await ensureApplication({
    ownerId: applicant.id,
    title: 'Спортивный фестиваль',
    tenderId: tender.id,
    directionId: null,
    statusId: statuses.draft,
    idea: '',
    importance: '',
    goal: '',
    tasks: '',
  });

  // 4. Публикации для ленты новостей.
  await ensurePost(
    'Открыт приём заявок на 2026 год',
    'Мы открыли приём заявок на конкурс **«Экологические инициативы»**.\n\n' +
      '- Приём заявок: до 30 марта 2026 года\n' +
      '- Направления: экология города и экологическое просвещение\n' +
      '- Максимальная сумма гранта: 150 000 ₽\n\n' +
      'Подать заявку можно в разделе «Мои заявки» после входа в систему.',
    true,
    adminId,
  );
  await ensurePost(
    'Как заполнить заявку: подсказки',
    '1. Опишите проблему, которую решает проект.\n' +
      '2. Сформулируйте измеримую цель.\n' +
      '3. Перечислите задачи и мероприятия с датами.\n' +
      '4. Обоснуйте бюджет и добавьте софинансирование.\n' +
      '5. Не забудьте загрузить файлы согласий участников команды.',
    true,
    adminId,
  );
  // Публикация от лица организации: автор скрыт в ленте (демо флага hide_author).
  await ensurePost(
    'Итоги года: сколько проектов мы поддержали',
    'За год фонд поддержал **12 проектов** в двух направлениях.\n\n' +
      'Спасибо всем участникам и партнёрам — вместе мы сделали город чище и добрее.',
    true,
    adminId,
    true,
  );
  await ensurePost(
    'Черновик: итоги прошлого сезона',
    'Публикация готовится. Здесь будут итоги сезона 2025 года и статистика по проектам.',
    false,
    adminId,
  );

  log.info('seed: демо-данные готовы');
}

/** Создаёт администратора и (по умолчанию) демо-данные. */
async function main(): Promise<void> {
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminEmail || !adminPassword) {
    throw new Error('[seed] Укажите ADMIN_EMAIL и ADMIN_PASSWORD в .env (см. .env.example)');
  }

  const statuses = await ensureStatuses();
  const reviewStatusByName = await ensureReviewStatuses();
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
