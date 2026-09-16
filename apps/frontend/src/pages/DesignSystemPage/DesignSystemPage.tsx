// Тестовая страница дизайн-системы: показывает все компоненты и их композицию.
import { useMemo, useState, type ReactNode } from 'react';
import type { RoleType } from '@arbuz/shared';
import {
  Accordion,
  AccordionItem,
  Badge,
  Button,
  Carousel,
  Checkbox,
  ConfirmDialog,
  Container,
  DateInput,
  DatePicker,
  DateRangeInput,
  DragDrop,
  EMPTY_DATE_RANGE,
  ICON_NAMES,
  Icon,
  Input,
  ListToolbar,
  Modal,
  NumberInput,
  Pagination,
  ROLE_OPTIONS,
  RangeDatePicker,
  RangeSlider,
  SearchInput,
  SectionHint,
  Select,
  Slider,
  StateMessage,
  StatusBadge,
  Table,
  useToast,
} from '../../components/ui';
import type { DateRange, NumericRange, SelectOption, StatusOption, TableColumn } from '../../components/ui';
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

/**
 * Прототип таблицы с выбором строк и сортировкой — тот же набор пропсов,
 * что используется в разделе «Экспертизы» (отчёт по выделенным строкам).
 */
function SelectionTablePrototype() {
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [sort, setSort] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);

  const rows = useMemo(() => {
    if (!sort) return DEMO_ROWS;
    const factor = sort.direction === 'asc' ? 1 : -1;
    return [...DEMO_ROWS].sort((a, b) => {
      if (sort.key === 'score') return (a.score - b.score) * factor;
      return a.title.localeCompare(b.title, 'ru') * factor;
    });
  }, [sort]);

  const columns: TableColumn<DemoRow>[] = [
    { key: 'title', header: 'Заявка', field: 'title' },
    { key: 'status', header: 'Статус', sortable: false, render: (row) => <StatusBadge value={row.status} options={DEMO_STATUS_OPTIONS} /> },
    { key: 'score', header: 'Балл', width: '90px', render: (row) => (row.score > 0 ? String(row.score) : '—') },
  ];

  return (
    <>
      <Table
        columns={columns}
        data={rows}
        rowKey={(row) => row.id}
        sortKey={sort?.key ?? null}
        sortDirection={sort?.direction ?? 'asc'}
        onSort={(key) => setSort((prev) => cycleSort(prev, key))}
        selection={{
          isSelected: (row) => selected.has(String(row.id)),
          onToggle: (row) =>
            setSelected((prev) => {
              const next = new Set(prev);
              if (next.has(String(row.id))) next.delete(String(row.id));
              else next.add(String(row.id));
              return next;
            }),
        }}
      />
      <div className={styles.selectionSummary}>
        Отмечено строк: <strong>{selected.size}</strong>
        {selected.size > 0 ? (
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
            Снять выделение
          </Button>
        ) : null}
      </div>
    </>
  );
}

/** asc → desc → без сортировки. */
function cycleSort(
  current: { key: string; direction: 'asc' | 'desc' } | null,
  key: string,
): { key: string; direction: 'asc' | 'desc' } | null {
  if (!current || current.key !== key) return { key, direction: 'asc' };
  if (current.direction === 'asc') return { key, direction: 'desc' };
  return null;
}

export function DesignSystemPage() {
  const [appStatus, setAppStatus] = useState<string>('draft');
  const [role, setRole] = useState<RoleType>('applicant');
  const [verdict, setVerdict] = useState<string>('1');
  const [sliderValue, setSliderValue] = useState(40);
  const [rangeValue, setRangeValue] = useState<NumericRange>({ from: 20, to: 70 });
  const [numberValue, setNumberValue] = useState(3);
  const [dateValue, setDateValue] = useState('2026-09-09');
  const [inputDate, setInputDate] = useState('2026-09-09');
  const [dateRange, setDateRange] = useState<DateRange>(EMPTY_DATE_RANGE);
  const [inputRange, setInputRange] = useState<DateRange>({ from: '2026-09-01', to: '2026-09-20' });
  const [checked, setChecked] = useState(true);
  const [files, setFiles] = useState<File[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [page, setPage] = useState(1);
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

      <Section title="Подсказка раздела">
        <SectionHint>
          Подсказка с иконкой «info»: так в карточке заявки объясняется назначение раздела. Тексты вынесены
          в <code>features/applications/section-hints.ts</code>.
        </SectionHint>
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
          <DateInput label="Дата с маской" value={inputDate} onChange={setInputDate} hint="дд.мм.гггг" />
        </div>

        <div className={styles.row}>
          <Checkbox label="Обычный чекбокс" checked={checked} onChange={setChecked} />
          <Checkbox label="Отмечен по умолчанию" checked onChange={() => undefined} />
          <Checkbox label="Недоступен" checked={false} onChange={() => undefined} disabled />
        </div>

        <div className={styles.grid2}>
          <RangeSlider
            label="Диапазон значений"
            value={rangeValue}
            onChange={setRangeValue}
            min={0}
            max={100}
            step={5}
          />
          <RangeSlider
            label="Диапазон с дробным шагом"
            value={{ from: 0.5, to: 2 }}
            onChange={() => undefined}
            min={0}
            max={5}
            step={0.5}
            unit="балла"
          />
        </div>
      </Section>

      <Section title="Календарь и выбор периода">
        <p className={styles.prototypeHint}>
          Календарь общий для всех полей (<code>CalendarPanel</code>): один или несколько месяцев сразу, а по клику
          на название месяца открывается выбор года — стрелки <code>‹ ›</code> двигают десятилетие,
          <code> ‹‹ ››</code> — столетие. Диапазоны сводят ввод и календарь к одному значению
          (<code>DateRange</code>), поэтому поля и календарь всегда синхронны.
        </p>
        <div className={styles.grid2}>
          <DatePicker label="Один месяц" value={dateValue} onChange={setDateValue} />
          <DatePicker label="Два месяца сразу" value={dateValue} onChange={setDateValue} months={2} />
        </div>
        <div className={styles.grid2}>
          <RangeSlider label="Диапазон баллов" value={rangeValue} onChange={setRangeValue} min={0} max={50} unit="из 50" />
          <RangeDatePicker
            label="Период (кнопка)"
            value={dateRange}
            onChange={setDateRange}
            min="2026-01-01"
            max="2026-12-31"
          />
        </div>
        <DateRangeInput
          label="Период (поля с маской + календарь)"
          value={inputRange}
          onChange={(next) =>
            setInputRange(
              next.to && next.from && next.to < next.from ? { from: next.from, to: next.from } : next,
            )
          }
          hint="Даты можно вводить вручную или отметить в календаре — значение одно и то же"
        />
      </Section>

      <Section title="Таблица (с бейджами-статусами)">
        <Table columns={columns} data={DEMO_ROWS} rowKey={(row) => row.id} />
      </Section>

      <Section title="Таблица с выбором строк и сортировкой">
        <p className={styles.prototypeHint}>
          Столбец чекбоксов включается пропсом <code>selection</code>: решение «строка выбрана» принимает
          страница (<code>isSelected</code>), поэтому ключи не могут разойтись. Клик по заголовку сортирует
          по кругу: <code>asc → desc → без сортировки</code>.
        </p>
        <SelectionTablePrototype />
      </Section>

      <Section title="Поиск и фильтры (прототип)">
        <p className={styles.prototypeHint}>
          Единый шаблон для таблиц: <code>ListToolbar</code> + <code>SearchInput</code> + <code>Select</code> +{' '}
          <code>Table</code>. Крупные списки фильтруются на сервере (параметр <code>q</code>), небольшие
          справочники — на клиенте. Состояния: загрузка, пусто, ошибка.
        </p>
        <ListToolbarPrototype />
      </Section>

      <Section title="Сообщения состояний и пагинация">
        <div className={styles.grid2}>
          <StateMessage state="loading" />
          <StateMessage state="empty" message="Пока ничего нет" />
        </div>
        <StateMessage state="error" message="Не удалось загрузить данные" onRetry={() => undefined} />
        <Pagination
          page={page}
          pageSize={10}
          total={42}
          onPageChange={setPage}
          onPageSizeChange={() => setPage(1)}
          pageSizeOptions={[10, 20, 50]}
        />
      </Section>

      <Section title="Модальные окна">
        <div className={styles.row}>
          <Button variant="secondary" icon="edit" onClick={() => setModalOpen(true)}>
            Открыть форму
          </Button>
          <Button variant="danger" icon="delete" onClick={() => setConfirmOpen(true)}>
            Открыть подтверждение
          </Button>
        </div>
        <p className={styles.prototypeHint}>
          По умолчанию окно закрывается только крестиком и кнопками: случайный клик мимо не теряет введённое.
          Пропс <code>dismissable</code> включается информационным диалогам.
        </p>
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

      <Modal
        open={modalOpen}
        title="Форма в модальном окне"
        onClose={() => setModalOpen(false)}
        width={480}
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Отмена
            </Button>
            <Button icon="check" onClick={() => setModalOpen(false)}>
              Сохранить
            </Button>
          </>
        }
      >
        <div className={styles.formStack}>
          <Input label="Название" placeholder="Например, «Чистые берега»" />
          <DateInput label="Дата" value={dateValue} onChange={setDateValue} />
        </div>
      </Modal>

      <ConfirmDialog
        open={confirmOpen}
        title="Удаление записи"
        message="Удалить выбранную запись? Действие нельзя отменить."
        confirmLabel="Удалить"
        danger
        onConfirm={() => {
          setConfirmOpen(false);
          showToast({ message: 'Запись удалена', tone: 'success' });
        }}
        onClose={() => setConfirmOpen(false)}
      />
    </main>
  );
}
