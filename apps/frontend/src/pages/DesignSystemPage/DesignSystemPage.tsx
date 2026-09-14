// Тестовая страница дизайн-системы: показывает все компоненты и их композицию.
import { useMemo, useState, type ReactNode } from 'react';
import type { RoleType } from '@arbuz/shared';
import {
  Accordion,
  AccordionItem,
  Badge,
  Button,
  Carousel,
  Container,
  DatePicker,
  DragDrop,
  ICON_NAMES,
  Icon,
  Input,
  ListToolbar,
  NumberInput,
  ROLE_OPTIONS,
  SearchInput,
  Select,
  Slider,
  StatusBadge,
  Table,
  useToast,
} from '../../components/ui';
import type { SelectOption, StatusOption, TableColumn } from '../../components/ui';
import styles from './DesignSystemPage.module.css';

// Демонстрационные статусы заявок (на проде приходят из GET /api/application-statuses).
const DEMO_STATUS_OPTIONS: readonly StatusOption<string>[] = [
  { value: 'draft', label: 'Черновик', tone: 'gray' },
  { value: 'under_review', label: 'На проверке', tone: 'yellow' },
  { value: 'accepted', label: 'Принята', tone: 'green' },
  { value: 'rejected', label: 'Отклонена', tone: 'red' },
];

// Демонстрационные вердикты (на проде приходят из GET /api/review-statuses).
const DEMO_VERDICT_OPTIONS: readonly StatusOption<string>[] = [
  { value: '1', label: 'На экспертизе', tone: 'gray', icon: 'edit' },
  { value: '2', label: 'Рекомендую поддержать', tone: 'green', icon: 'check' },
  { value: '3', label: 'Не рекомендую поддержать', tone: 'red', icon: 'close' },
];

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Container title={title} className={styles.section}>
      {children}
    </Container>
  );
}

interface DemoRow {
  id: number;
  title: string;
  status: string;
  role: RoleType;
  score: number;
}

const DEMO_ROWS: DemoRow[] = [
  { id: 1, title: 'Экологический субботник', status: 'under_review', role: 'applicant', score: 13 },
  { id: 2, title: 'Школьный музей', status: 'accepted', role: 'applicant', score: 17.5 },
  { id: 3, title: 'Спортивный фестиваль', status: 'draft', role: 'applicant', score: 0 },
];

const DEMO_STATUS_FILTER_OPTIONS: readonly SelectOption<string>[] = DEMO_STATUS_OPTIONS.map((option) => ({
  value: option.value,
  label: option.label,
}));

/**
 * Прототип поиска и фильтрации списка: ListToolbar + SearchInput + Select + Table.
 * Шаблон для всех таблиц: поиск с задержкой ввода, фильтры-селекты, состояния empty/loading/error.
 */
function ListToolbarPrototype() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');

  const rows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return DEMO_ROWS.filter((row) => {
      if (status && row.status !== status) return false;
      return !needle || row.title.toLowerCase().includes(needle);
    });
  }, [search, status]);

  const columns: TableColumn<DemoRow>[] = [
    { key: 'title', header: 'Заявка', field: 'title' },
    { key: 'status', header: 'Статус', render: (row) => <StatusBadge value={row.status} options={DEMO_STATUS_OPTIONS} /> },
    { key: 'score', header: 'Балл', render: (row) => (row.score > 0 ? String(row.score) : '—') },
  ];

  return (
    <>
      <ListToolbar>
        <SearchInput placeholder="Поиск по названию заявки" onChange={setSearch} />
        <Select label="Статус" placeholder="Все статусы" value={status} onChange={setStatus} options={DEMO_STATUS_FILTER_OPTIONS} />
      </ListToolbar>
      <Table columns={columns} data={rows} rowKey={(row) => row.id} emptyText="Ничего не найдено" />
    </>
  );
}

export function DesignSystemPage() {
  const [appStatus, setAppStatus] = useState<string>('draft');
  const [role, setRole] = useState<RoleType>('applicant');
  const [verdict, setVerdict] = useState<string>('1');
  const [sliderValue, setSliderValue] = useState(40);
  const [numberValue, setNumberValue] = useState(3);
  const [dateValue, setDateValue] = useState('2026-09-09');
  const [files, setFiles] = useState<File[]>([]);
  const { showToast } = useToast();

  const columns: TableColumn<DemoRow>[] = [
    { key: 'title', header: 'Заявка', field: 'title' },
    {
      key: 'status',
      header: 'Статус',
      render: (row) => <StatusBadge value={row.status} options={DEMO_STATUS_OPTIONS} />,
    },
    { key: 'role', header: 'Роль', render: (row) => <StatusBadge value={row.role} options={ROLE_OPTIONS} /> },
    { key: 'score', header: 'Балл', render: (row) => (row.score > 0 ? String(row.score) : '—') },
  ];

  return (
    <main className={styles.page}>
      <h1 className={styles.h1}>Дизайн-система Arbuz CRM</h1>
      <p className={styles.lead}>
        Тестовая страница: каждый компонент можно вкладывать в другой — иконка в кнопку, кнопка в карусель, карусель в
        аккордеон, аккордеон в контейнер.
      </p>

      <Section title="Иконки">
        <div className={styles.iconGrid}>
          {ICON_NAMES.map((name) => (
            <span key={name} className={styles.iconCell} title={name}>
              <Icon name={name} size={22} />
              <span className={styles.iconLabel}>{name}</span>
            </span>
          ))}
        </div>
      </Section>

      <Section title="Кнопки">
        <div className={styles.row}>
          <Button variant="primary" icon="plus">Создать заявку</Button>
          <Button variant="secondary" icon="download">Скачать PDF</Button>
          <Button variant="ghost" icon="edit">Редактировать</Button>
          <Button variant="danger" icon="close">Удалить</Button>
          <Button variant="primary" icon="upload" iconPosition="end">Загрузить файл</Button>
          <Button variant="primary" icon="check" disabled>Отправлено</Button>
        </div>
        <div className={styles.row}>
          <Button size="sm" variant="secondary" icon="plus">Маленькая</Button>
          <Button size="lg" variant="primary" icon="user">Большая</Button>
          <Button variant="secondary" fullWidth>На всю ширину</Button>
        </div>
      </Section>

      <Section title="Бейджики (слова)">
        <div className={styles.row}>
          <Badge tone="neutral">Нейтральный</Badge>
          <Badge tone="blue">Синий</Badge>
          <Badge tone="green" icon="check">Зелёный</Badge>
          <Badge tone="yellow" icon="info">Жёлтый</Badge>
          <Badge tone="red" icon="warning">Красный</Badge>
          <Badge tone="purple">Фиолетовый</Badge>
          <Badge tone="gray">Серый</Badge>
        </div>
      </Section>

      <Section title="Бейджики-статусы (статические и сменные)">
        <div className={styles.row}>
          <span className={styles.caption}>Статичные:</span>
          <StatusBadge value="under_review" options={DEMO_STATUS_OPTIONS} />
          <StatusBadge value="2" options={DEMO_VERDICT_OPTIONS} />
          <StatusBadge value="expert" options={ROLE_OPTIONS} />
        </div>
        <div className={styles.row}>
          <span className={styles.caption}>С выпадающим списком:</span>
          <StatusBadge value={appStatus} options={DEMO_STATUS_OPTIONS} onChange={setAppStatus} />
          <StatusBadge value={role} options={ROLE_OPTIONS} onChange={setRole} />
          <StatusBadge value={verdict} options={DEMO_VERDICT_OPTIONS} onChange={setVerdict} />
        </div>
      </Section>

      <Section title="Контейнер">
        <Container title="Вложенный контейнер" tone="muted" actions={<Button size="sm" variant="secondary">Действие</Button>}>
          <p>Контент карточки. Тон: muted. Контейнер принимает заголовок, действия и любых детей.</p>
        </Container>
      </Section>

      <Section title="Аккордеон → Карусель → Кнопки (композиция)">
        <Accordion>
          <AccordionItem itemKey="compose" title="Развернуть: внутри карусель с кнопками" defaultOpen>
            <Carousel showDots autoPlayMs={0}>
              <div className={styles.slide}>
                <h3>Слайд 1 — кнопки с иконками</h3>
                <div className={styles.row}>
                  <Button variant="primary" icon="plus">Добавить</Button>
                  <Button variant="secondary" icon="download">Скачать</Button>
                </div>
              </div>
              <div className={styles.slide}>
                <h3>Слайд 2 — бейдж статуса</h3>
                <StatusBadge value="2" options={DEMO_VERDICT_OPTIONS} />
              </div>
              <div className={styles.slide}>
                <h3>Слайд 3 — карточка</h3>
                <Container title="Внутри слайда" tone="accent">
                  Иконка: <Icon name="calendar" size={18} />
                </Container>
              </div>
            </Carousel>
          </AccordionItem>
          <AccordionItem itemKey="second" title="Вторая секция (закрыта по умолчанию)">
            <Badge tone="blue" icon="info">Аккордеон скрывает и разворачивает контент</Badge>
          </AccordionItem>
        </Accordion>
      </Section>

      <Section title="Drag & drop поле">
        <DragDrop
          accept=".pdf,.docx,image/*,video/mp4"
          onFiles={(selected) => setFiles(selected)}
          hint="Перетащите PDF/DOCX/изображения/MP4 (до 10 МБ на файл)"
        />
        {files.length > 0 && (
          <div className={styles.row}>
            {files.map((file, index) => (
              <Badge key={`${file.name}-${index}`} tone="blue" icon="document">
                {file.name} ({Math.round(file.size / 1024)} КБ)
              </Badge>
            ))}
          </div>
        )}
      </Section>

      <Section title="Поля форм">
        <div className={styles.grid2}>
          <Input label="Email" type="email" placeholder="user@example.com" icon="mail" />
          <Input label="Пароль" type="password" placeholder="••••••••" icon="lock" />
          <Input label="С ошибкой" value="некорректно" error="Поле заполнено неверно" />
          <Input label="С подсказкой" hint="Например, название организации" />
          <NumberInput label="Количество" value={numberValue} onChange={setNumberValue} min={0} max={20} />
          <Slider label="Балл" value={sliderValue} onChange={setSliderValue} min={0} max={100} />
          <DatePicker label="Дата" value={dateValue} onChange={setDateValue} />
        </div>
      </Section>

      <Section title="Таблица (с бейджами-статусами)">
        <Table columns={columns} data={DEMO_ROWS} rowKey={(row) => row.id} />
      </Section>

      <Section title="Поиск и фильтры (прототип)">
        <p className={styles.prototypeHint}>
          Единый шаблон для таблиц: <code>ListToolbar</code> + <code>SearchInput</code> + <code>Select</code> +{' '}
          <code>Table</code>. Крупные списки фильтруются на сервере (параметр <code>q</code>), небольшие
          справочники — на клиенте. Состояния: загрузка, пусто, ошибка.
        </p>
        <ListToolbarPrototype />
      </Section>

      <Section title="Уведомления (toast)">
        <div className={styles.row}>
          <Button
            variant="primary"
            icon="check"
            onClick={() => showToast({ message: 'Заявка сохранена', tone: 'success' })}
          >
            Успех
          </Button>
          <Button
            variant="danger"
            icon="warning"
            onClick={() => showToast({ message: 'Не удалось сохранить заявку', tone: 'error' })}
          >
            Ошибка
          </Button>
          <Button
            variant="secondary"
            icon="info"
            onClick={() => showToast({ message: 'Черновик сохранён локально', tone: 'info' })}
          >
            Инфо
          </Button>
          <Button
            variant="secondary"
            icon="trash"
            onClick={() =>
              showToast({
                message: 'Заявка удалена',
                tone: 'info',
                action: { label: 'Отменить', onClick: () => showToast({ message: 'Действие отменено', tone: 'success' }) },
              })
            }
          >
            С действием
          </Button>
        </div>
      </Section>
    </main>
  );
}
