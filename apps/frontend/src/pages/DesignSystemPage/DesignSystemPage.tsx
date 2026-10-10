// Дизайн-система #Арбузныйгрант: документация по компонентам и UI/UX.
//
// Страница разбита на вкладки (основы, формы, данные, обратная связь, макет, иконки).
// Каждый компонент описан текстом, показан живым примером (в пунктирной рамке — видно
// габариты) и коротким примером кода.
import { useMemo, useState, type ReactNode } from 'react';
import type { RoleType } from '@arbuz/shared';
import {
  Accordion,
  AccordionItem,
  ActiveFilters,
  Badge,
  Button,
  Carousel,
  Checkbox,
  CheckboxGroupFilter,
  ConfirmDialog,
  Container,
  DataView,
  DateInput,
  DatePicker,
  DateRangeFilter,
  DateRangeInput,
  DragDrop,
  EMPTY_DATE_RANGE,
  ICON_NAMES,
  Icon,
  Input,
  KebabMenu,
  Modal,
  MultiSelectFilter,
  NumberInput,
  Pagination,
  RangeDatePicker,
  RangeFilter,
  RangeSlider,
  ROLE_OPTIONS,
  RowActions,
  SearchField,
  SectionHint,
  Select,
  Slider,
  StateMessage,
  StatusBadge,
  Table,
  Textarea,
  useDataViewState,
  useTableReorder,
  useToast,
} from '../../components/ui';
import type {
  DateRange,
  DateRangeValue,
  FilterSpec,
  NumericRange,
  RangeValue,
  SelectOption,
  StatusOption,
  TableColumn,
} from '../../components/ui';
import { formatDateTime } from '../../lib/format';
import styles from './DesignSystemPage.module.css';

type TabId = 'basics' | 'forms' | 'data' | 'feedback' | 'layout' | 'icons';

const TABS: ReadonlyArray<{ id: TabId; label: string }> = [
  { id: 'basics', label: 'Основы' },
  { id: 'forms', label: 'Формы' },
  { id: 'data', label: 'Данные' },
  { id: 'feedback', label: 'Обратная связь' },
  { id: 'layout', label: 'Макет и навигация' },
  { id: 'icons', label: 'Иконки' },
];

const DEMO_STATUS_OPTIONS: readonly StatusOption<string>[] = [
  { value: 'draft', label: 'Черновик', tone: 'gray' },
  { value: 'under_review', label: 'На проверке', tone: 'yellow' },
  { value: 'accepted', label: 'Принята', tone: 'green' },
  { value: 'rejected', label: 'Отклонена', tone: 'red' },
];

const DEMO_VERDICT_OPTIONS: readonly StatusOption<string>[] = [
  { value: '1', label: 'На экспертизе', tone: 'gray', icon: 'edit' },
  { value: '2', label: 'Рекомендую поддержать', tone: 'green', icon: 'check' },
  { value: '3', label: 'Не рекомендую поддержать', tone: 'red', icon: 'close' },
];

const DEMO_TONE_OPTIONS: readonly SelectOption<string>[] = DEMO_STATUS_OPTIONS.map((option) => ({
  value: option.value,
  label: option.label,
}));

interface DemoRow {
  id: number;
  title: string;
  status: string;
  role: RoleType;
  score: number;
  createdAt: string;
}

const DEMO_ROWS: DemoRow[] = [
  { id: 1, title: 'Экологический субботник', status: 'under_review', role: 'applicant', score: 13, createdAt: '2026-09-02' },
  { id: 2, title: 'Школьный музей', status: 'accepted', role: 'applicant', score: 17.5, createdAt: '2026-09-11' },
  { id: 3, title: 'Спортивный фестиваль', status: 'draft', role: 'applicant', score: 0, createdAt: '2026-09-21' },
];

/** Карточка компонента: заголовок, пояснение, пример (в рамке) и код. */
function DocItem({
  title,
  description,
  code,
  column,
  children,
}: {
  title: string;
  description?: ReactNode;
  code?: string;
  column?: boolean;
  children: ReactNode;
}) {
  return (
    <section className={styles.item}>
      <header className={styles.itemHead}>
        <h3 className={styles.itemTitle}>{title}</h3>
        {description ? <p className={styles.itemDesc}>{description}</p> : null}
      </header>
      <div className={`${styles.preview} ${column ? styles.previewColumn : ''}`}>{children}</div>
      {code ? (
        <details className={styles.codeWrap}>
          <summary className={styles.codeSummary}>Пример кода</summary>
          <pre className={styles.code}>
            <code>{code}</code>
          </pre>
        </details>
      ) : null}
    </section>
  );
}

// --- Вкладка «Основы» ---

const COLOR_TOKENS: ReadonlyArray<{ name: string; label: string }> = [
  { name: '--color-primary', label: 'Основной (действие)' },
  { name: '--color-primary-hover', label: 'Основной · наведение' },
  { name: '--color-success', label: 'Успех' },
  { name: '--color-danger', label: 'Ошибка/опасность' },
  { name: '--color-text', label: 'Текст' },
  { name: '--color-muted', label: 'Текст приглушённый' },
  { name: '--color-border', label: 'Границы' },
  { name: '--color-surface', label: 'Поверхность' },
  { name: '--tone-blue-bg', label: 'Тон · синий' },
  { name: '--tone-red-bg', label: 'Тон · красный' },
  { name: '--tone-green-bg', label: 'Тон · зелёный' },
  { name: '--tone-yellow-bg', label: 'Тон · жёлтый' },
  { name: '--tone-purple-bg', label: 'Тон · фиолетовый' },
  { name: '--tone-gray-bg', label: 'Тон · серый' },
];

const SPACINGS = ['--space-1', '--space-2', '--space-3', '--space-4', '--space-5', '--space-6', '--space-8'] as const;
const RADII = ['--radius-sm', '--radius-md', '--radius-lg'] as const;
const SHADOWS = ['--shadow-sm', '--shadow-md', '--shadow-lg'] as const;

function BasicsTab() {
  return (
    <div className={styles.panel}>
      <DocItem
        title="Цвет"
        column
        description="Все цвета берутся из CSS-переменных темы. Тона (tone) — светлый фон + насыщенный текст: используются в бейджах, шапках, подсветке строк."
        code={`.panel {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  color: var(--color-text);
}`}
      >
        <div className={styles.swatchGrid}>
          {COLOR_TOKENS.map((token) => (
            <div key={token.name} className={styles.swatch}>
              <div className={styles.swatchColor} style={{ background: `var(${token.name})` }} />
              <div className={styles.swatchLabel}>
                {token.label}
                <br />
                <code>{token.name}</code>
              </div>
            </div>
          ))}
        </div>
      </DocItem>

      <DocItem
        title="Типографика"
        column
        description="Один системный шрифт, размеры по назначению. Заголовки — semibold, служебный текст — приглушённый и мельче."
        code={`<h1>Заголовок страницы</h1>
<p className="muted">Пояснение к разделу</p>`}
      >
        <div className={styles.typeRow} style={{ fontSize: 26, fontWeight: 700 }}>
          Заголовок страницы — 26px
        </div>
        <div className={styles.typeRow} style={{ fontSize: 20, fontWeight: 700 }}>
          Заголовок раздела — 20px
        </div>
        <div className={styles.typeRow} style={{ fontSize: 14 }}>
          Основной текст интерфейса — 14px
        </div>
        <div className={styles.typeRow} style={{ fontSize: 13, color: 'var(--color-muted)' }}>
          Служебный/приглушённый текст — 13px
        </div>
      </DocItem>

      <DocItem
        title="Отступы"
        column
        description="Шаг сетки — переменные --space-*. Внутренние отступы карточек и расстояния между блоками берутся только из них."
        code={`padding: var(--space-4);
gap: var(--space-3);`}
      >
        {SPACINGS.map((token) => (
          <div key={token} className={styles.spacingRow}>
            <code>{token}</code>
            <span className={styles.spacingBox} style={{ width: `var(${token})` }} />
          </div>
        ))}
      </DocItem>

      <DocItem
        title="Радиусы и тени"
        description="Радиус — мягкий, единый для карточек и полей. Тень — только для приподнятых поверхностей (карточки, выпадающие панели)."
        code={`border-radius: var(--radius-md);
box-shadow: var(--shadow-md);`}
      >
        {RADII.map((token) => (
          <div
            key={token}
            className={styles.swatch}
            style={{ width: 140, padding: 12, borderRadius: `var(${token})`, border: '1px solid var(--color-border)' }}
          >
            <code>{token}</code>
          </div>
        ))}
        {SHADOWS.map((token) => (
          <div
            key={token}
            style={{
              width: 140,
              padding: 12,
              borderRadius: 'var(--radius-sm)',
              background: 'var(--color-surface)',
              boxShadow: `var(${token})`,
            }}
          >
            <code>{token}</code>
          </div>
        ))}
      </DocItem>

      <DocItem
        title="Принципы"
        column
        description="Короткие правила интерфейса, которые соблюдаются во всех разделах."
      >
        <ul className={styles.note} style={{ lineHeight: 1.8, margin: 0, paddingLeft: 20 }}>
          <li>Все переиспользуемые элементы — только из <code>components/ui</code> (единый barrel-импорт).</li>
          <li>Никаких магических строк для статусов и ролей: значения приходят из API/типов <code>@arbuz/shared</code>.</li>
          <li>Модальные окна по умолчанию не закрываются кликом мимо и по Esc — форма не теряет введённое.</li>
          <li>Списки админки используют общий <code>DataView</code>: состояние в адресе, ссылка шарится.</li>
          <li>Доступность: подписи у полей, <code>aria-*</code> у таблиц и модалок, навигация с клавиатуры.</li>
        </ul>
      </DocItem>
    </div>
  );
}

// --- Вкладка «Формы» ---

function FormsTab() {
  const [status, setStatus] = useState('under_review');
  const [tone, setTone] = useState('accepted');
  const [number, setNumber] = useState(3);
  const [text, setText] = useState('Описание проекта');
  const [slider, setSlider] = useState(40);
  const [range, setRange] = useState<NumericRange>({ from: 20, to: 70 });
  const [date, setDate] = useState('2026-09-09');
  const [inputDate, setInputDate] = useState('2026-09-09');
  const [dateRange, setDateRange] = useState<DateRange>(EMPTY_DATE_RANGE);
  const [inputRange, setInputRange] = useState<DateRange>({ from: '2026-09-01', to: '2026-09-20' });
  const [checked, setChecked] = useState(true);

  return (
    <div className={styles.panel}>
      <DocItem
        title="Button"
        description="Основное действие — primary (один на экран), вторичные — secondary/ghost, деструктивные — danger. Есть размеры, иконка и состояние загрузки."
        code={`<Button icon="add" onClick={...}>Добавить</Button>
<Button variant="secondary">Отмена</Button>
<Button variant="ghost" icon="edit" aria-label="Изменить" />
<Button variant="danger">Удалить</Button>
<Button loading>Сохраняем…</Button>`}
      >
        <Button>Primary</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="danger">Danger</Button>
        <Button icon="add">С иконкой</Button>
        <Button loading>Загрузка</Button>
        <Button disabled>Недоступно</Button>
        <Button size="sm">sm</Button>
        <Button size="lg">lg</Button>
      </DocItem>

      <DocItem
        title="Input / NumberInput / Textarea"
        column
        description="Текстовое поле с подписью, подсказкой и ошибкой. NumberInput — числовое поле (type=number) с границами; Textarea — многострочный ввод (в т.ч. Markdown)."
        code={`<Input label="Email" type="email" icon="mail" value={...} onChange={...} />
<Input label="Ошибка" error="Обязательное поле" />
<NumberInput label="Кол-во" value={3} min={0} onChange={...} />
<Textarea label="Описание" value={...} onChange={...} rows={4} />`}
      >
        <div className={styles.grid2}>
          <div className={styles.formDemo}>
            <Input label="Обычное поле" icon="user" value={text} onChange={(event) => setText(event.target.value)} />
            <Input label="С подсказкой" value={text} onChange={() => undefined} hint="Например, короткое пояснение" />
            <Input label="С ошибкой" value="" onChange={() => undefined} error="Поле обязательно" />
            <NumberInput label="Количество" value={number} min={0} max={20} onChange={setNumber} />
            <Textarea label="Многострочное" value={text} onChange={(event) => setText(event.target.value)} rows={3} />
          </div>
        </div>
      </DocItem>

      <DocItem
        title="Select / Checkbox"
        column
        description="Select — одиночный выбор из списка с плейсхолдером. Checkbox — булев флаг; подпись кликабельна."
        code={`<Select label="Статус" placeholder="Все статусы" value={status} onChange={setStatus} options={options} />
<Checkbox label="Согласен с условиями" checked={checked} onChange={setChecked} />`}
      >
        <div className={styles.formDemo}>
          <Select label="Статус" placeholder="Все статусы" value={status} onChange={setStatus} options={DEMO_TONE_OPTIONS} />
          <Select label="Вердикт" placeholder="Без вердикта" value={tone} onChange={setTone} options={DEMO_TONE_OPTIONS} />
          <Checkbox label="Показывать на главной" checked={checked} onChange={setChecked} />
        </div>
      </DocItem>

      <DocItem
        title="Slider / RangeSlider"
        column
        description="Slider — одно значение; RangeSlider — диапазон с двумя бегунками и точными числовыми полями. Границы не перескакивают друг через друга."
        code={`<Slider label="Балл" value={slider} min={0} max={100} onChange={setSlider} />
<RangeSlider label="Диапазон" value={range} min={0} max={100} onChange={setRange} />`}
      >
        <div className={styles.formDemo}>
          <Slider label="Балл" value={slider} min={0} max={100} onChange={setSlider} />
          <RangeSlider label="Диапазон" value={range} min={0} max={100} step={5} onChange={setRange} />
        </div>
      </DocItem>

      <DocItem
        title="Даты и периоды"
        column
        description="Один календарь на все поля. DatePicker/RangeDatePicker — выбор кнопкой; DateInput/DateRangeInput — ручной ввод по маске дд.мм.гггг. RangeDatePicker показывает два месяца сразу."
        code={`<DatePicker label="Дата" value={date} onChange={setDate} />
<DateInput label="Дата вручную" value={inputDate} onChange={setInputDate} />
<RangeDatePicker label="Период" value={dateRange} onChange={setDateRange} months={2} />
<DateRangeInput label="Период вручную" value={inputRange} onChange={setInputRange} />`}
      >
        <div className={styles.grid2}>
          <div className={styles.formDemo}>
            <DatePicker label="Дата (кнопка)" value={date} onChange={setDate} />
            <DateInput label="Дата (вручную)" value={inputDate} onChange={setInputDate} />
          </div>
          <div className={styles.formDemo}>
            <RangeDatePicker label="Период (кнопка)" value={dateRange} onChange={setDateRange} />
            <DateRangeInput label="Период (вручную)" value={inputRange} onChange={setInputRange} />
          </div>
        </div>
      </DocItem>

      <DocItem
        title="DragDrop"
        description="Зона загрузки файлов: перетаскивание или выбор кликом. Поддерживает фильтр по типам и множественный выбор."
        code={`<DragDrop accept=".pdf,.docx,image/*" onFiles={setFiles} hint="Перетащите файл или нажмите" />`}
      >
        <div style={{ width: '100%' }}>
          <DragDrop accept=".pdf,.docx,image/*" hint="Перетащите файл документа или нажмите для выбора" />
        </div>
      </DocItem>
    </div>
  );
}

// --- Вкладка «Данные» ---

function ReorderTablePrototype() {
  const [rows, setRows] = useState<DemoRow[]>(DEMO_ROWS);

  const reorder = useTableReorder<DemoRow>({
    items: rows,
    id: (row) => row.id,
    onReorder: (draggedId, targetId) => {
      setRows((prev) => {
        const from = prev.findIndex((row) => row.id === draggedId);
        const to = prev.findIndex((row) => row.id === targetId);
        if (from < 0 || to < 0 || from === to) return prev;
        const next = [...prev];
        const [moved] = next.splice(from, 1);
        next.splice(to, 0, moved);
        return next;
      });
    },
  });

  const columns: TableColumn<DemoRow>[] = [
    {
      key: 'drag',
      header: '',
      width: '36px',
      sortable: false,
      render: (row, index) => (
        <span
          {...reorder.getHandleProps(row, index)}
          className={styles.dragHandle}
          role="button"
          tabIndex={0}
          title="Перетащите, чтобы изменить порядок"
          aria-label="Перетащите, чтобы изменить порядок"
        >
          <Icon name="drag-vertical" size={16} />
        </span>
      ),
    },
    { key: 'title', header: 'Заявка', field: 'title' },
    { key: 'status', header: 'Статус', render: (row) => <StatusBadge value={row.status} options={DEMO_STATUS_OPTIONS} /> },
  ];

  return (
    <Table
      columns={columns}
      data={rows}
      rowKey={(row) => row.id}
      sortable={false}
      rowClassName={(row, index) => reorder.getRowClassName(row, index)}
      rowStyle={(row, index) => reorder.getRowStyle(row, index)}
    />
  );
}

function SelectionTablePrototype() {
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());

  const columns: TableColumn<DemoRow>[] = [
    { key: 'title', header: 'Заявка', field: 'title' },
    { key: 'status', header: 'Статус', render: (row) => <StatusBadge value={row.status} options={DEMO_STATUS_OPTIONS} /> },
    { key: 'score', header: 'Балл', width: '90px', render: (row) => (row.score > 0 ? String(row.score) : '—') },
  ];

  const toggle = (row: DemoRow) =>
    setSelected((prev) => {
      const next = new Set(prev);
      const key = String(row.id);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  return (
    <>
      <Table
        columns={columns}
        data={DEMO_ROWS}
        rowKey={(row) => row.id}
        selection={{ isSelected: (row) => selected.has(String(row.id)), onToggle: toggle }}
      />
      <div className={styles.row} style={{ marginTop: 'var(--space-3)' }}>
        <span className="muted">Отмечено: {selected.size}</span>
        {selected.size > 0 ? (
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
            Снять выделение
          </Button>
        ) : null}
      </div>
    </>
  );
}

function DataViewPrototype() {
  const [rows] = useState<DemoRow[]>(DEMO_ROWS);

  const specs = useMemo<FilterSpec[]>(
    () => [
      {
        kind: 'multi-select',
        field: 'post',
        label: 'По заявке',
        placeholder: 'Название заявки…',
        loadOptions: async (search) => {
          const needle = search.trim().toLowerCase();
          return rows
            .filter((row) => !needle || row.title.toLowerCase().includes(needle))
            .map((row) => ({ value: String(row.id), label: row.title }));
        },
      },
      {
        kind: 'checkbox-group',
        field: 'status',
        label: 'Статус',
        options: DEMO_STATUS_OPTIONS.map((option) => ({ value: option.value, label: option.label })),
      },
      { kind: 'range', field: 'score', label: 'Балл', min: 0, max: 20, step: 1 },
      { kind: 'date-range', field: 'created', label: 'Дата создания', presets: true },
    ],
    [rows],
  );

  const state = useDataViewState({ specs, defaultPageSize: 20 });
  const { query } = state;

  const filtered = useMemo(() => {
    const needle = query.search.trim().toLowerCase();
    const ids = (query.filters.post as string[] | undefined) ?? [];
    const statuses = (query.filters.status as string[] | undefined) ?? [];
    const score = query.filters.score as RangeValue | undefined;
    const created = query.filters.created as DateRangeValue | undefined;
    return rows.filter((row) => {
      if (needle && !row.title.toLowerCase().includes(needle)) return false;
      if (ids.length && !ids.includes(String(row.id))) return false;
      if (statuses.length && !statuses.includes(row.status)) return false;
      if (score?.min != null && row.score < score.min) return false;
      if (score?.max != null && row.score > score.max) return false;
      if (created?.from && row.createdAt < created.from) return false;
      if (created?.to && row.createdAt > created.to) return false;
      return true;
    });
  }, [rows, query]);

  const columns: TableColumn<DemoRow>[] = [
    { key: 'title', header: 'Заявка', field: 'title' },
    { key: 'status', header: 'Статус', render: (row) => <StatusBadge value={row.status} options={DEMO_STATUS_OPTIONS} /> },
    { key: 'score', header: 'Балл', width: '90px', render: (row) => (row.score > 0 ? String(row.score) : '—') },
    { key: 'created_at', header: 'Создана', render: (row) => formatDateTime(row.createdAt) },
  ];

  return (
    <DataView
      state={state}
      mode="advanced"
      search={{ placeholder: 'Поиск по названию' }}
      columns={columns}
      rows={filtered}
      rowKey={(row) => row.id}
      total={filtered.length}
      paginated={false}
      emptyText="Заявок нет"
      noResultsText="Ничего не найдено"
    />
  );
}

function DataTab() {
  const [page, setPage] = useState(1);

  const columns: TableColumn<DemoRow>[] = [
    { key: 'title', header: 'Заявка', field: 'title' },
    { key: 'status', header: 'Статус', render: (row) => <StatusBadge value={row.status} options={DEMO_STATUS_OPTIONS} /> },
    { key: 'score', header: 'Балл', width: '90px', render: (row) => (row.score > 0 ? String(row.score) : '—') },
  ];

  return (
    <div className={styles.panel}>
      <DocItem
        title="Badge / StatusBadge"
        description="Badge — метка с тоном. StatusBadge — бейдж статуса/роли; если передать onChange, превращается в выпадающий список смены значения."
        code={`<Badge tone="blue">Синий</Badge>
<StatusBadge value="accepted" options={statusOptions} />
<StatusBadge value="expert" options={ROLE_OPTIONS} />
<StatusBadge value={verdictId} options={verdictOptions} onChange={setVerdictId} />`}
      >
        <Badge tone="neutral">Нейтральный</Badge>
        <Badge tone="blue">Синий</Badge>
        <Badge tone="green" icon="check">Принята</Badge>
        <Badge tone="red">Отклонена</Badge>
        <StatusBadge value="under_review" options={DEMO_STATUS_OPTIONS} />
        <StatusBadge value="accepted" options={DEMO_STATUS_OPTIONS} onChange={() => undefined} />
        <StatusBadge value="expert" options={ROLE_OPTIONS} />
        <StatusBadge value="3" options={DEMO_VERDICT_OPTIONS} />
      </DocItem>

      <DocItem
        title="Table"
        description="Универсальная таблица: произвольный рендер ячеек, сортировка по клику на заголовок (asc → desc → сброс), опциональный выбор строк."
        code={`<Table
  columns={columns}
  data={rows}
  rowKey={(row) => row.id}
  onRowClick={(row) => ...}
/>`}
      >
        <div style={{ width: '100%' }}>
          <Table columns={columns} data={DEMO_ROWS} rowKey={(row) => row.id} />
        </div>
      </DocItem>

      <DocItem
        title="Table — выбор строк"
        column
        description="Пропс selection принимает предикат «выбрана» и обработчик переключения; решение о ключах принимает вызывающая сторона."
        code={`const [selected, setSelected] = useState(new Set());
<Table columns={columns} data={rows} rowKey={(r) => r.id}
  selection={{ isSelected: (r) => selected.has(String(r.id)), onToggle: toggle }} />`}
      >
        <SelectionTablePrototype />
      </DocItem>

      <DocItem
        title="Table — ручной порядок (drag-and-drop)"
        column
        description="useTableReorder даёт ручку перетаскивания и подсветку строк. Ручной порядок имеет смысл только без сортировки/фильтров, поэтому таблица включает sortable={false}, а страница скрывает ручку при активных фильтрах."
        code={`const reorder = useTableReorder({ items, id: (r) => r.id, onReorder: (from, to) => ... });
<Table columns={columns} data={items} sortable={false}
  rowClassName={(r, i) => reorder.getRowClassName(r, i)}
  rowStyle={(r, i) => reorder.getRowStyle(r, i)} />`}
      >
        <div style={{ width: '100%' }}>
          <ReorderTablePrototype />
        </div>
      </DocItem>

      <DocItem
        title="Pagination"
        description="Диапазон показанных записей, выбор размера страницы и переходы вперёд/назад."
        code={`<Pagination page={page} pageSize={20} total={120}
  onPageChange={setPage} onPageSizeChange={...} />`}
      >
        <div style={{ width: '100%' }}>
          <Pagination page={page} pageSize={20} total={120} onPageChange={setPage} />
        </div>
      </DocItem>

      <DocItem
        title="DataView — панель списка"
        column
        description="Единая панель для админских таблиц. Режимы minimal / standard / advanced / pro; поиск, фасетные фильтры (checkbox-group, select, multi-select с автокомплитом, date-range с пресетами, range), активные чипы, сортировка и пагинация. Состояние синхронизируется с query-параметрами через useDataViewState."
        code={`const specs: FilterSpec[] = [ ... ];
const state = useDataViewState({ specs, defaultPageSize: 20 });
<DataView state={state} mode="advanced"
  search={{ placeholder: 'Поиск' }}
  columns={columns} rows={filtered} rowKey={(r) => r.id} total={filtered.length} />`}
      >
        <DataViewPrototype />
      </DocItem>

      <DocItem
        title="Примитивы фильтров"
        column
        description="Отдельные контролы, из которых собирается панель. Используйте их и внутри DataView, и самостоятельно."
        code={`<SearchField value={q} onChange={setQ} />
<CheckboxGroupFilter label="Статус" options={options} value={values} onChange={setValues} />
<MultiSelectFilter label="Эксперт" value={values} onChange={setValues} loadOptions={load} />  // loadOptions: (search) => Promise<FilterOption[]>
<DateRangeFilter label="Период" value={range} onChange={setRange} presets />
<RangeFilter label="Балл" value={range} onChange={setRange} min={0} max={100} />
<ActiveFilters filters={chips} onRemove={...} onResetAll={...} />`}
      >
        <FilterPrimitivesDemo />
      </DocItem>
    </div>
  );
}

function FilterPrimitivesDemo() {
  const [search, setSearch] = useState('');
  const [statuses, setStatuses] = useState<string[]>(['under_review']);
  const [period, setPeriod] = useState<DateRangeValue>({ from: '', to: '' });
  const [score, setScore] = useState<RangeValue>({ min: null, max: null });
  const [experts, setExperts] = useState<string[]>([]);

  const loadExperts = useMemo(
    () => async (needle: string): Promise<SelectOption<string>[]> => {
      const all = ['Анна Петрова', 'Игорь Соколов', 'Мария Волкова', 'Пётр Иванов'];
      const lower = needle.trim().toLowerCase();
      return all
        .filter((name) => name.toLowerCase().includes(lower))
        .map((name) => ({ value: name, label: name }));
    },
    [],
  );

  return (
    <div className={styles.formDemo} style={{ width: '100%' }}>
      <SearchField value={search} onChange={setSearch} placeholder="Поиск…" />
      <CheckboxGroupFilter
        label="Статус"
        options={DEMO_STATUS_OPTIONS.map((option) => ({ value: option.value, label: option.label }))}
        value={statuses}
        onChange={setStatuses}
      />
      <MultiSelectFilter
        label="Эксперт"
        placeholder="Найдите эксперта…"
        value={experts}
        onChange={setExperts}
        loadOptions={loadExperts}
      />
      <DateRangeFilter label="Период" value={period} onChange={setPeriod} presets />
      <RangeFilter label="Балл" value={score} onChange={setScore} min={0} max={20} step={1} />
      <ActiveFilters
        filters={[
          { key: 'status:under_review', field: 'status', label: 'Статус', text: 'На проверке' },
        ]}
        onRemove={() => undefined}
        onResetAll={() => undefined}
      />
    </div>
  );
}

// --- Вкладка «Обратная связь» ---

function FeedbackTab() {
  const { showToast } = useToast();
  const [modalOpen, setModalOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  return (
    <div className={styles.panel}>
      <DocItem
        title="StateMessage"
        description="Единый вид состояний данных: загрузка, пусто, ошибка с кнопкой повтора."
        code={`<StateMessage state="loading" />
<StateMessage state="empty" message="Пока ничего нет" />
<StateMessage state="error" message="Не удалось загрузить" onRetry={load} />`}
      >
        <div className={styles.grid2}>
          <StateMessage state="loading" />
          <StateMessage state="empty" message="Ничего не найдено" />
          <StateMessage state="error" message="Ошибка загрузки" onRetry={() => undefined} />
        </div>
      </DocItem>

      <DocItem
        title="Modal / ConfirmDialog"
        description="Modal — окно с заголовком и контентом (по умолчанию не закрывается мимо/Esc, чтобы не терять данные). ConfirmDialog — подтверждение опасного действия."
        code={`<Modal open={open} title="Заголовок" onClose={close}>...</Modal>
<ConfirmDialog open={confirm} title="Удаление" message="Удалить запись?"
  danger confirmLabel="Удалить" onConfirm={...} onClose={close} />`}
      >
        <Button variant="secondary" onClick={() => setModalOpen(true)}>
          Открыть Modal
        </Button>
        <Button variant="danger" onClick={() => setConfirmOpen(true)}>
          Открыть ConfirmDialog
        </Button>

        <Modal open={modalOpen} title="Пример модального окна" onClose={() => setModalOpen(false)} width={420}>
          <div className={styles.formDemo}>
            <p style={{ margin: 0 }}>Окно не закрывается кликом мимо и по Esc — только явно.</p>
            <Input label="Поле" value="" onChange={() => undefined} />
            <div className={styles.row}>
              <Button variant="secondary" onClick={() => setModalOpen(false)}>
                Отмена
              </Button>
              <Button onClick={() => setModalOpen(false)}>Готово</Button>
            </div>
          </div>
        </Modal>

        <ConfirmDialog
          open={confirmOpen}
          title="Удаление записи"
          message="Действие необратимо. Продолжить?"
          confirmLabel="Удалить"
          danger
          onConfirm={() => setConfirmOpen(false)}
          onClose={() => setConfirmOpen(false)}
        />
      </DocItem>

      <DocItem
        title="Toast — быстрые уведомления"
        description="Всплывают на несколько секунд, показывают, что только что произошло, и могут предложить действие с отменой. Есть обратный отсчёт и пауза при наведении."
        code={`const { showToast } = useToast();
showToast({ message: 'Сохранено', tone: 'success' });
showToast({ message: 'Удалено', tone: 'error' });
showToast({ message: 'Роль изменена', tone: 'success',
  action: { label: 'Отменить', onClick: undo } });`}
      >
        <Button variant="secondary" onClick={() => showToast({ message: 'Успешно сохранено', tone: 'success' })}>
          Успех
        </Button>
        <Button variant="secondary" onClick={() => showToast({ message: 'Что-то пошло не так', tone: 'error' })}>
          Ошибка
        </Button>
        <Button variant="secondary" onClick={() => showToast({ message: 'Обратите внимание', tone: 'info' })}>
          Инфо
        </Button>
        <Button
          variant="secondary"
          onClick={() =>
            showToast({
              message: 'Роль изменена',
              tone: 'success',
              action: { label: 'Отменить', onClick: () => showToast({ message: 'Изменение отменено', tone: 'info' }) },
            })
          }
        >
          С действием
        </Button>
      </DocItem>

      <DocItem
        title="SectionHint"
        column
        description="Пояснение к разделу формы: иконка «инфо» и текст. Подсказка не заменяет подпись поля и не является ошибкой."
        code={`<SectionHint>Заполните состав команды и приложите согласия.</SectionHint>`}
      >
        <SectionHint>Опишите цель проекта и ожидаемые результаты — это поможет экспертам.</SectionHint>
      </DocItem>
    </div>
  );
}

// --- Вкладка «Макет и навигация» ---

function LayoutTab() {
  return (
    <div className={styles.panel}>
      <DocItem
        title="Container"
        description="Карточка-обёртка с заголовком и зоной действий справа. Тон default — белая карточка, muted — серый фон."
        code={`<Container title="Пользователи" actions={<Button icon="add">Добавить</Button>}>
  ...содержимое...
</Container>`}
      >
        <div style={{ width: '100%' }}>
          <Container title="Раздел с действием" actions={<Button size="sm" icon="add">Добавить</Button>}>
            <p style={{ margin: 0 }}>Содержимое карточки.</p>
          </Container>
        </div>
      </DocItem>

      <DocItem
        title="Accordion"
        column
        description="Раскрывающиеся секции. Сворачивание — только по кнопке с шевроном справа (клик по заголовку содержимое не прячет). defaultOpen раскрывает при показе; allowMultiple разрешает несколько открытых сразу."
        code={`<Accordion allowMultiple>
  <AccordionItem itemKey="a" title="Раздел A" defaultOpen>...</AccordionItem>
  <AccordionItem itemKey="b" title="Раздел B">...</AccordionItem>
</Accordion>`}
      >
        <Accordion>
          <AccordionItem itemKey="a" title="Первый раздел" defaultOpen>
            <p style={{ margin: 0 }}>Содержимое первой секции.</p>
          </AccordionItem>
          <AccordionItem itemKey="b" title="Второй раздел">
            <p style={{ margin: 0 }}>Содержимое второй секции.</p>
          </AccordionItem>
        </Accordion>
      </DocItem>

      <DocItem
        title="Carousel"
        column
        description="Каждый дочерний элемент — отдельный слайд. Точки-индикаторы включаются showDots; autoPlayMs добавляет автопрокрутку."
        code={`<Carousel showDots>
  <div>Слайд 1</div>
  <div>Слайд 2</div>
</Carousel>`}
      >
        <Carousel showDots>
          <div style={{ padding: 'var(--space-6)', textAlign: 'center', background: 'var(--tone-blue-bg)' }}>Слайд 1</div>
          <div style={{ padding: 'var(--space-6)', textAlign: 'center', background: 'var(--tone-green-bg)' }}>Слайд 2</div>
          <div style={{ padding: 'var(--space-6)', textAlign: 'center', background: 'var(--tone-yellow-bg)' }}>Слайд 3</div>
        </Carousel>
      </DocItem>

      <DocItem
        title="RowActions / KebabMenu"
        description="RowActions показывает основные действия иконками на десктопе и сворачивает всё в kebab-меню на мобильном. KebabMenu — само выпадающее меню «⋮»."
        code={`<RowActions ariaLabel="Действия" items={[
  { key: 'edit', label: 'Изменить', icon: 'edit', onSelect: ... },
  { key: 'del', label: 'Удалить', icon: 'delete', danger: true, placement: 'menu', onSelect: ... },
]} />`}
      >
        <RowActions
          ariaLabel="Демонстрационные действия"
          items={[
            { key: 'edit', label: 'Изменить', icon: 'edit', onSelect: () => undefined },
            { key: 'copy', label: 'Копировать', icon: 'chain', onSelect: () => undefined },
            { key: 'del', label: 'Удалить', icon: 'delete', danger: true, placement: 'menu', onSelect: () => undefined },
          ]}
        />
        <KebabMenu
          label="Меню"
          items={[
            { key: 'edit', label: 'Изменить', icon: 'edit', onSelect: () => undefined },
            { key: 'del', label: 'Удалить', icon: 'delete', danger: true, onSelect: () => undefined },
          ]}
        />
      </DocItem>
    </div>
  );
}

// --- Вкладка «Иконки» ---

function IconsTab() {
  return (
    <div className={styles.panel}>
      <DocItem
        title="Icon"
        column
        description="Кастомные SVG из src/assets/icons/* (подхватываются автоматически, цвет наследуется от родителя через currentColor). Есть поворот, отражение, прозрачность и фон."
        code={`<Icon name="check" size={18} />
<Icon name="chevron-down" rotate={180} />`}
      >
        <div className={styles.iconGrid}>
          {ICON_NAMES.map((name) => (
            <div key={name} className={styles.iconCell}>
              <Icon name={name} size={20} />
              <span className={styles.iconLabel}>{name}</span>
            </div>
          ))}
        </div>
      </DocItem>
    </div>
  );
}

export function DesignSystemPage() {
  const [tab, setTab] = useState<TabId>('basics');

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.h1}>Дизайн-система</h1>
        <p className={styles.lead}>
          Живая документация: назначение каждого компонента, пример использования и код. Все элементы — из общего
          barrel-импорта <code>components/ui</code>; цвета и отступы задаются токенами темы.
        </p>
      </header>

      <div className={styles.tabs} role="tablist" aria-label="Разделы дизайн-системы">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            className={`${styles.tab} ${tab === item.id ? styles.tabActive : ''}`}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === 'basics' ? <BasicsTab /> : null}
      {tab === 'forms' ? <FormsTab /> : null}
      {tab === 'data' ? <DataTab /> : null}
      {tab === 'feedback' ? <FeedbackTab /> : null}
      {tab === 'layout' ? <LayoutTab /> : null}
      {tab === 'icons' ? <IconsTab /> : null}
    </div>
  );
}
