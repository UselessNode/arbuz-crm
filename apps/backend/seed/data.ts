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

export type SeedUserKey =
  | 'applicant'
  | 'applicant2'
  | 'applicant3'
  | 'expert1'
  | 'expert2'
  | 'expert3'
  | 'expert4';

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
  {
    key: 'applicant2',
    role: RoleType.applicant,
    emailEnv: 'DEMO2_EMAIL',
    email: 'demo2@arbuz.local',
    passwordEnv: 'DEMO2_PASSWORD',
    password: 'demo12345',
    surname: 'Орлов',
    name: 'Игорь',
    patronymic: 'Викторович',
  },
  {
    key: 'applicant3',
    role: RoleType.applicant,
    emailEnv: 'DEMO3_EMAIL',
    email: 'demo3@arbuz.local',
    passwordEnv: 'DEMO3_PASSWORD',
    password: 'demo12345',
    surname: 'Никитина',
    name: 'Мария',
    patronymic: 'Олеговна',
  },
  {
    key: 'expert3',
    role: RoleType.expert,
    emailEnv: 'EXPERT3_EMAIL',
    email: 'expert3@arbuz.local',
    passwordEnv: 'EXPERT3_PASSWORD',
    password: 'expert12345',
    surname: 'Соколов',
    name: 'Павел',
    patronymic: 'Андреевич',
  },
  {
    key: 'expert4',
    role: RoleType.expert,
    emailEnv: 'EXPERT4_EMAIL',
    email: 'expert4@arbuz.local',
    passwordEnv: 'EXPERT4_PASSWORD',
    password: 'expert12345',
    surname: 'Морозова',
    name: 'Ольга',
    patronymic: 'Игоревна',
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

const BASE_APPLICATIONS: readonly SeedApplication[] = [
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

// --- Сгенерированный объёмный набор заявок (пагинация и связи) ---
// Детерминированные данные: одинаковы при каждом запуске, поэтому seed остаётся идемпотентным
// (ключ — владелец + заголовок). Нужны, чтобы проверить пагинацию списков и связи
// (состав/план/бюджет/экспертизы) на реальном объёме.

const GENERATED_TOPICS: readonly string[] = [
  'Раздельный сбор отходов в школах',
  'Городской экологический фестиваль',
  'Пункт приёма вторсырья во дворе',
  'Зелёные крыши детских садов',
  'Экскурсии по перерабатывающему заводу',
  'Буккроссинг и обмен вещами',
  'Очистка малых рек города',
  'Школьная теплица и агро-класс',
  'Эко-маршрут по паркам',
  'Мастерская ремонта вещей',
  'Сбор батареек и ламп',
  'Птичьи домики в городских парках',
  'Компостирование в ЖК',
  'Эко-квест для школьников',
  'Велопрокат для сотрудников',
  'Озеленение школьных дворов',
  'Пластик в дело: переработка',
  'Экология водоёмов',
  'Лекарственный огород у поликлиники',
  'Мобильный эко-лекторий',
  'Фестиваль апсайклинга',
  'Чистый лес: волонтёрские выезды',
  'Карта пунктов раздельного сбора',
  'Эко-сумки для покупателей',
  'Открытие общественного огорода',
  'Лаборатория чистоты воды',
  'Вторая жизнь электроники',
  'Природные тропы в пригороде',
  'Эко-кинотеатр под открытым небом',
  'Кружок юного эколога',
];

const GENERATED_OWNERS: readonly SeedUserKey[] = ['applicant', 'applicant2', 'applicant3', 'applicant'];
const GENERATED_EXPERTS: readonly SeedUserKey[] = ['expert1', 'expert2', 'expert3', 'expert4'];
const GENERATED_STATUS_CYCLE: readonly ApplicationStatusKey[] = [
  'draft',
  'submitted',
  'submitted',
  'accepted',
  'rejected',
  'submitted',
  'submitted',
];

const GEN_SURNAMES = ['Иванов', 'Петрова', 'Сидоров', 'Кузнецова', 'Смирнов', 'Фёдорова', 'Ковалёв', 'Тихонова'];
const GEN_NAMES = ['Алексей', 'Мария', 'Сергей', 'Ольга', 'Дмитрий', 'Анна', 'Павел', 'Ирина'];
const GEN_PATRONYMICS = ['Иванович', 'Петровна', 'Сергеевич', 'Андреевна', 'Олегович', 'Викторовна'];
const GEN_TASKS = [
  'Координация проекта',
  'Работа с волонтёрами',
  'Ведение бюджета',
  'Коммуникация с партнёрами',
  'Подготовка материалов',
  'Логистика мероприятий',
];
const GEN_EVENTS = [
  'Подготовительный этап',
  'Основное мероприятие',
  'Информационная кампания',
  'Итоговая встреча',
];
const GEN_BUDGET = [
  'Инвентарь и расходники',
  'Аренда помещения',
  'Полиграфия',
  'Питание участников',
  'Оплата координатора',
  'Транспортные расходы',
];

function buildGeneratedApplications(): SeedApplication[] {
  return GENERATED_TOPICS.map((topic, index) => {
    const ownerKey = GENERATED_OWNERS[index % GENERATED_OWNERS.length];
    const statusKey = GENERATED_STATUS_CYCLE[index % GENERATED_STATUS_CYCLE.length];
    // Каждый третий — без направления (проверка пустого направления в заявке).
    const directionIndex = index % 3 === 2 ? null : index % SEED_TENDER.directions.length;

    const membersCount = index % 5; // 0..4
    const members: SeedMember[] = Array.from({ length: membersCount }, (_, m) => ({
      surname: GEN_SURNAMES[(index + m) % GEN_SURNAMES.length],
      name: GEN_NAMES[(index + m) % GEN_NAMES.length],
      patronymic: GEN_PATRONYMICS[(index + m) % GEN_PATRONYMICS.length],
      tasks: GEN_TASKS[(index + m) % GEN_TASKS.length],
      isCoordinator: m === 0,
      isResponsible: m === 1,
    }));

    const plansCount = index % 4; // 0..3
    const plans: SeedPlan[] = Array.from({ length: plansCount }, (_, p) => {
      const month = ((index + p) % 9) + 1; // январь–сентябрь 2026
      const monthStr = String(month).padStart(2, '0');
      return {
        task: GEN_EVENTS[(index + p) % GEN_EVENTS.length],
        event: `${GEN_EVENTS[(index + p) % GEN_EVENTS.length]} №${p + 1}`,
        description: 'Мероприятие из плана проекта',
        start: `2026-${monthStr}-05`,
        end: `2026-${monthStr}-12`,
      };
    });

    const budgetCount = index % 5; // 0..4
    const budget: SeedBudgetItem[] = Array.from({ length: budgetCount }, (_, b) => ({
      resource: GEN_BUDGET[(index + b) % GEN_BUDGET.length],
      quantity: ((index + b) % 8) + 1,
      unitCost: (((index + b) % 10) + 1) * 1500,
      own: ((index + b) % 3) * 5000,
      grant: (((index + b) % 6) + 1) * 4000,
    }));

    // Экспертизы — только у отправленных/завершённых заявок; два разных эксперта.
    const reviews: SeedReview[] =
      statusKey === 'draft'
        ? []
        : [
            {
              expertKey: GENERATED_EXPERTS[index % GENERATED_EXPERTS.length],
              statusName: index % 2 === 0 ? 'Рекомендую поддержать' : 'Не рекомендую поддержать',
              text: 'Проект проработан, бюджет реалистичен, команда имеет опыт.',
            },
            {
              expertKey: GENERATED_EXPERTS[(index + 2) % GENERATED_EXPERTS.length],
              statusName: index % 3 === 0 ? 'На экспертизе' : 'Рекомендую поддержать',
            },
          ];

    return {
      ownerKey,
      title: `Тестовая заявка №${String(index + 1).padStart(2, '0')}: ${topic}`,
      statusKey,
      directionIndex,
      idea: `Проект «${topic}» направлен на улучшение экологической ситуации в городе.`,
      importance: 'Проблема актуальна для жителей и требует системного решения.',
      goal: 'Вовлечь сообщество и получить измеримый экологический результат.',
      tasks: 'Провести подготовку, реализовать мероприятия, подвести итоги.',
      experience: 'Команда реализовала похожие инициативы ранее.',
      results: 'Ожидается рост вовлечённости и улучшение городской среды.',
      members,
      plans,
      budget,
      reviews,
    };
  });
}

export const SEED_APPLICATIONS: readonly SeedApplication[] = [
  ...BASE_APPLICATIONS,
  ...buildGeneratedApplications(),
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
  /** Закрепление в ленте (показывается первым). */
  pinned?: boolean;
  /** Ручной порядок внутри группы. */
  sortOrder?: number;
}

const BASE_POSTS: readonly SeedPost[] = [
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

// --- Сгенерированный объёмный набор публикаций (пагинация ленты и списка) ---
// Детерминированные заголовки → seed идемпотентен (ключ — заголовок).

const GENERATED_POST_TOPICS: readonly string[] = [
  'Стартовал новый сезон грантов',
  'Открыт набор экспертов',
  'Подведены итоги весеннего отбора',
  'Онлайн-встреча с участниками',
  'Изменения в правилах подачи',
  'История одного проекта: чистые берега',
  'Приём заявок: частые вопросы',
  'Советы по составлению бюджета',
  'Партнёры сезона: кто поддерживает',
  'Обучение для координаторов',
  'Как описать социальный эффект',
  'Отчёт о расходовании гранта',
  'Экскурсия на производство переработки',
  'Итоги опроса участников',
  'Новый раздел с документами',
  'Примеры успешных заявок',
  'Календарь мероприятий сезона',
  'Интервью с экспертом фонда',
  'Как работает экспертиза заявок',
  'Сбор обратной связи',
  'Работа над ошибками прошлого сезона',
  'Инструкция: загрузка согласий',
  'Партнёрская программа для школ',
  'Экология города: промежуточные итоги',
];

function buildGeneratedPosts(): SeedPost[] {
  return GENERATED_POST_TOPICS.map((topic, index) => {
    const mod = index % 6;
    const base: SeedPost = {
      title: `Новость №${String(index + 1).padStart(2, '0')}: ${topic}`,
      status: 'published',
      content:
        `# ${topic}\n\n` +
        'Коротко о главном: команда фонда делится новостями и полезными материалами для участников.\n\n' +
        '- приём заявок открыт;\n' +
        '- следите за обновлениями;\n' +
        '- задавайте вопросы организаторам.\n\n' +
        '> [!NOTE]\n> Полный текст доступен в разделе новостей.',
    };
    if (mod === 1) return { ...base, editedDaysAgo: 2 };
    if (mod === 2) return { ...base, hideAuthor: true };
    if (mod === 3) return { ...base, status: 'draft' };
    if (mod === 4) return { ...base, status: 'scheduled', scheduledInDays: 3 + index };
    if (mod === 5) return { ...base, status: 'archived' };
    return base;
  });
}

/** Закреплённые публикации — показываются первыми (проверка сортировки ленты). */
const PINNED_POSTS: readonly SeedPost[] = [
  {
    title: 'Закреплено: правила приёма заявок сезона 2026',
    status: 'published',
    pinned: true,
    sortOrder: 0,
    content:
      '# Правила приёма заявок\n\n' +
      '1. Зарегистрируйтесь и заполните заявку.\n' +
      '2. Загрузите согласия всех участников команды.\n' +
      '3. Отправьте заявку на проверку.\n\n' +
      '==Важно:== заявки принимаются до **20 ноября**.',
  },
  {
    title: 'Закреплено: график вебинаров для участников',
    status: 'published',
    pinned: true,
    sortOrder: 1,
    content: 'Расписание онлайн-встреч и ответы на частые вопросы — в этой публикации.',
  },
];

export const SEED_POSTS: readonly SeedPost[] = [
  ...BASE_POSTS,
  ...PINNED_POSTS,
  ...buildGeneratedPosts(),
];

// --- Публичные документы ---

export interface SeedDocument {
  title: string;
  description: string;
  /** Имя файла на диске (расширение задаёт тип). */
  fileName: string;
}

export const SEED_DOCUMENTS: readonly SeedDocument[] = [
  {
    title: 'Положение о конкурсе 2026',
    description: 'Порядок проведения, требования к участникам и критерии оценки.',
    fileName: 'polozhenie-2026.pdf',
  },
  {
    title: 'Форма заявки (образец)',
    description: 'Образец заявки для подготовки к подаче.',
    fileName: 'forma-zayavki.pdf',
  },
  {
    title: 'Согласие на обработку персональных данных',
    description: 'Типовая форма согласия для участников команды.',
    fileName: 'soglasie-pdn.pdf',
  },
  {
    title: 'Методические рекомендации по бюджету',
    description: 'Как составить и обосновать смету проекта.',
    fileName: 'rekomendacii-byudzhet.pdf',
  },
];
