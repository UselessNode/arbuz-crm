// Декларативные тестовые данные seed-скрипта.
//
// Здесь только значения — логика создания записей живёт в соседних модулях
// (users/tenders/applications/reviews/posts). Чтобы добавить тестовую сущность,
// достаточно дописать объект в массив ниже; порядок массивов задаёт порядок создания.
import { RoleType } from '@arbuz/shared';
import { APPLICATION_STATUS_NAMES } from '../lib/app-status';

// --- Справочники ---

export type ApplicationStatusKey = 'draft' | 'submitted' | 'accepted' | 'rejected';

/** Базовые статусы заявок (создаются, если справочник пуст). */
export const APPLICATION_STATUS_SEED: ReadonlyArray<{
  key: ApplicationStatusKey;
  name: string;
  is_editable: boolean;
  is_deletable: boolean;
  description: string;
}> = [
  { key: 'draft', name: APPLICATION_STATUS_NAMES.draft, is_editable: true, is_deletable: true, description: 'Заявка создаётся, ещё не отправлена' },
  { key: 'submitted', name: APPLICATION_STATUS_NAMES.submitted, is_editable: false, is_deletable: false, description: 'Заявка отправлена экспертам' },
  { key: 'accepted', name: 'Принята', is_editable: false, is_deletable: false, description: 'Заявка одобрена' },
  { key: 'rejected', name: 'Отклонена', is_editable: false, is_deletable: false, description: 'Заявка отклонена' },
];

/** Базовые вердикты экспертиз (редактируемый справочник). */
export const REVIEW_STATUS_SEED = [
  { name: 'На экспертизе', tone: 'gray', is_default: true, description: 'Экспертиза начата, вердикт ещё не выставлен' },
  { name: 'Рекомендую поддержать', tone: 'green', is_default: false, description: 'Эксперт рекомендует поддержать заявку' },
  { name: 'Не рекомендую поддержать', tone: 'red', is_default: false, description: 'Эксперт не рекомендует поддержку заявки' },
] as const;

// --- Пользователи ---

export type SeedUserKey = 'applicant' | 'expert1' | 'expert2';

export interface SeedUser {
  key: SeedUserKey;
  role: RoleType;
  /** Переменная окружения с email (перекрывает `email`). */
  emailEnv: string;
  /** Значение email по умолчанию. */
  email: string;
  /** Переменная окружения с паролем (перекрывает `password`). */
  passwordEnv: string;
  password: string;
  surname?: string;
  name?: string;
  patronymic?: string;
}

export const SEED_USERS: readonly SeedUser[] = [
  {
    key: 'applicant',
    role: RoleType.applicant,
    emailEnv: 'DEMO_EMAIL',
    email: 'demo@arbuz.local',
    passwordEnv: 'DEMO_PASSWORD',
    password: 'demo12345',
    surname: 'Смирнова',
    name: 'Анна',
    patronymic: 'Петровна',
  },
  {
    key: 'expert1',
    role: RoleType.expert,
    emailEnv: 'EXPERT_EMAIL',
    email: 'expert@arbuz.local',
    passwordEnv: 'EXPERT_PASSWORD',
    password: 'expert12345',
    surname: 'Кузнецов',
    name: 'Дмитрий',
    patronymic: 'Сергеевич',
  },
  {
    key: 'expert2',
    role: RoleType.expert,
    emailEnv: 'EXPERT2_EMAIL',
    email: 'expert2@arbuz.local',
    passwordEnv: 'EXPERT2_PASSWORD',
    password: 'expert12345',
    surname: 'Волкова',
    name: 'Елена',
    patronymic: 'Андреевна',
  },
];

// --- Конкурс ---

export interface SeedTender {
  name: string;
  description: string;
  expertsCount: number;
  criteria: ReadonlyArray<{ name: string; description: string; min: number; max: number; weight: number }>;
  directions: ReadonlyArray<{ name: string; description: string }>;
}

export const SEED_TENDER: SeedTender = {
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
};

// --- Заявки ---

export interface SeedMember {
  surname: string;
  name: string;
  patronymic?: string;
  /** Роль участника в проекте. */
  tasks: string;
  isCoordinator?: boolean;
  isResponsible?: boolean;
}

export interface SeedPlan {
  task: string;
  event: string;
  description: string;
  /** Дата начала (YYYY-MM-DD). */
  start: string;
  /** Дата окончания (YYYY-MM-DD). */
  end: string;
}

export interface SeedBudgetItem {
  resource: string;
  quantity: number;
  unitCost: number;
  /** Свои средства. */
  own: number;
  /** Запрашиваемые средства. */
  grant: number;
  comment?: string;
}

export interface SeedReview {
  expertKey: SeedUserKey;
  /** Название вердикта из `REVIEW_STATUS_SEED`. */
  statusName: string;
  text?: string;
}

export interface SeedApplication {
  ownerKey: SeedUserKey;
  title: string;
  statusKey: ApplicationStatusKey;
  /** Индекс направления в `SEED_TENDER.directions`; null — направление не выбрано. */
  directionIndex: number | null;
  idea: string;
  importance: string;
  goal: string;
  tasks: string;
  experience?: string;
  results?: string;
  members?: readonly SeedMember[];
  plans?: readonly SeedPlan[];
  budget?: readonly SeedBudgetItem[];
  reviews?: readonly SeedReview[];
}

export const SEED_APPLICATIONS: readonly SeedApplication[] = [
  // 1. Черновик с заполненным составом (без согласий — демонстрирует диалог при отправке).
  {
    ownerKey: 'applicant',
    title: 'Чистые берега',
    statusKey: 'draft',
    directionIndex: 0,
    idea: 'Организовать серию субботников на берегах городских водоёмов с раздельным сбором мусора.',
    importance: 'Загрязнение берегов влияет на качество воды и отдых горожан.',
    goal: 'Очистить 5 км береговой линии и вовлечь 100 волонтёров.',
    tasks: 'Подготовить инвентарь, провести 4 субботника, организовать вывоз и переработку отходов.',
    experience: 'В 2025 году провели 2 субботника с участием 60 человек.',
    results: '5 км чистых берегов, 100 волонтёров, 2 тонны собранного мусора.',
    members: [
      {
        surname: 'Смирнова',
        name: 'Анна',
        patronymic: 'Петровна',
        tasks: 'Координация проекта и работа с волонтёрами',
        isCoordinator: true,
      },
      { surname: 'Петров', name: 'Алексей', tasks: 'Логистика и вывоз отходов', isResponsible: true },
    ],
    plans: [
      {
        task: 'Провести субботники',
        event: 'Субботник «Чистый берег»',
        description: 'Уборка берега с раздельным сбором отходов',
        start: '2026-04-15',
        end: '2026-04-15',
      },
      {
        task: 'Организовать переработку',
        event: 'Передача отходов на переработку',
        description: 'Сортировка и передача вторсырья партнёру',
        start: '2026-04-20',
        end: '2026-04-22',
      },
    ],
    budget: [
      { resource: 'Инвентарь (перчатки, мешки)', quantity: 100, unitCost: 150, own: 5000, grant: 10000 },
      { resource: 'Вывоз и переработка отходов', quantity: 2, unitCost: 12000, own: 0, grant: 24000 },
      { resource: 'Питание волонтёров', quantity: 100, unitCost: 300, own: 10000, grant: 20000 },
    ],
  },
  // 2. Отправленная заявка с двумя назначенными экспертами (для проверки экспертизы).
  {
    ownerKey: 'applicant',
    title: 'Школьный экомузей',
    statusKey: 'submitted',
    directionIndex: 1,
    idea: 'Создать в школе экспозицию о переработке отходов и провести цикл занятий.',
    importance: 'Экологическое просвещение школьников формирует привычки на всю жизнь.',
    goal: 'Открыть музей и провести 10 занятий для 250 учеников.',
    tasks: 'Собрать экспонаты, оформить зал, обучить экскурсоводов, провести занятия.',
    results: 'Действующий музей и 250 обученных школьников.',
    members: [
      {
        surname: 'Смирнова',
        name: 'Анна',
        patronymic: 'Петровна',
        tasks: 'Координация и взаимодействие со школой',
        isCoordinator: true,
      },
    ],
    plans: [
      {
        task: 'Открыть экспозицию',
        event: 'Открытие экомузея',
        description: 'Торжественное открытие и первая экскурсия',
        start: '2026-09-10',
        end: '2026-09-10',
      },
    ],
    budget: [
      { resource: 'Витрины и стенды', quantity: 6, unitCost: 8000, own: 10000, grant: 38000 },
      { resource: 'Полиграфия для занятий', quantity: 250, unitCost: 120, own: 0, grant: 30000 },
    ],
    reviews: [
      {
        expertKey: 'expert1',
        statusName: 'Рекомендую поддержать',
        text: 'Проект решает актуальную задачу, план и бюджет реалистичны, команда имеет опыт.',
      },
      { expertKey: 'expert2', statusName: 'На экспертизе' },
    ],
  },
  // 3. Пустой черновик — демонстрация пустых состояний и подсказок.
  {
    ownerKey: 'applicant',
    title: 'Спортивный фестиваль',
    statusKey: 'draft',
    directionIndex: null,
    idea: '',
    importance: '',
    goal: '',
    tasks: '',
  },
];

// --- Публикации ---

export type SeedPostStatus = 'draft' | 'scheduled' | 'published' | 'archived';

export interface SeedPost {
  title: string;
  content: string;
  status: SeedPostStatus;
  /** Скрывать автора в ленте (обратная связь от организации). */
  hideAuthor?: boolean;
  /** Для `scheduled`: через сколько дней от запуска seed выйдет публикация. */
  scheduledInDays?: number;
  /** Сколько дней назад правили содержимое (пометка «Отредактировано»). */
  editedDaysAgo?: number;
}

export const SEED_POSTS: readonly SeedPost[] = [
  {
    title: 'Открыт приём заявок на 2026 год',
    status: 'published',
    content:
      'Мы открыли приём заявок на конкурс **«Экологические инициативы»**.\n\n' +
      '- Приём заявок: до 30 марта 2026 года\n' +
      '- Направления: экология города и экологическое просвещение\n' +
      '- Максимальная сумма гранта: 150 000 ₽\n\n' +
      'Подать заявку можно в разделе «Мои заявки» после входа в систему.',
  },
  {
    title: 'Как заполнить заявку: подсказки',
    status: 'published',
    editedDaysAgo: 3,
    content:
      '1. Опишите проблему, которую решает проект.\n' +
      '2. Сформулируйте измеримую цель.\n' +
      '3. Перечислите задачи и мероприятия с датами.\n' +
      '4. Обоснуйте бюджет и добавьте софинансирование.\n' +
      '5. Не забудьте загрузить файлы согласий участников команды.',
  },
  // Публикация от лица организации: автор скрыт в ленте (демо флага hide_author).
  {
    title: 'Итоги года: сколько проектов мы поддержали',
    status: 'published',
    hideAuthor: true,
    content:
      'За год фонд поддержал **12 проектов** в двух направлениях.\n\n' +
      'Спасибо всем участникам и партнёрам — вместе мы сделали город чище и добрее.',
  },
  // Отложенная публикация: появится в ленте сама, когда наступит дата.
  {
    title: 'Приём заявок продлён до 15 апреля',
    status: 'scheduled',
    scheduledInDays: 7,
    content: 'По многочисленным просьбам участников мы продлеваем приём заявок на две недели.',
  },
  // Архив: скрыта из ленты, но доступна администратору в разделе «Публикации».
  {
    title: 'Итоги сезона 2024 года',
    status: 'archived',
    content: 'Собрали статистику прошлого сезона: 8 поддержанных проектов и 4 200 участников.',
  },
  // Черновик: виден только в разделе «Публикации» (демо статуса draft).
  {
    title: 'Черновик: итоги прошлого сезона',
    status: 'draft',
    content: 'Публикация готовится. Здесь будут итоги сезона 2025 года и статистика по проектам.',
  },
];
