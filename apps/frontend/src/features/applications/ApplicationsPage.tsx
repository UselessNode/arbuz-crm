// Админский раздел «Заявки»: список заявок и настройка подсказок к разделам формы.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge, Button, Container, DataView, MultiSelectFilter, StateMessage, StatusBadge, Textarea, useDataViewState, useToast } from '../../components/ui';
import type { DateRangeValue, FilterSpec, StatusOption, TableColumn } from '../../components/ui';
import { toneFromString } from '../../components/ui/Badge/Badge';
import { applicationsApi, type ApplicationSummary } from '../../api/applications';
import { statusesApi, tendersApi } from '../../api/references';
import { usersApi } from '../../api/users';
import { documentsApi, type PublicDocument } from '../../api/documents';
import { SECTION_HINT_KEYS, sectionHintsApi, type SectionHintKey } from '../../api/section-hints';
import { ApiError } from '../../api/client';
import { formatDateTime, formatUserName } from '../../lib/format';
import { Roles } from '../../lib/roles';
import styles from './Applications.module.css';

type Tab = 'list' | 'template';

const SECTION_LABELS: Record<SectionHintKey, string> = {
  main: 'Основное',
  team: 'Команда',
  plans: 'План мероприятий',
  budget: 'Бюджет',
  materials: 'Материалы',
  reviews: 'Экспертизы',
};

export function ApplicationsPage() {
  const [tab, setTab] = useState<Tab>('list');

  return (
    <div>
      <h1 className={styles.pageTitle}>Заявки</h1>
      <div className={styles.tabs} role="tablist" aria-label="Разделы">
        <Button size="sm" variant={tab === 'list' ? 'primary' : 'secondary'} role="tab" aria-selected={tab === 'list'} onClick={() => setTab('list')}>
          Заявки
        </Button>
        <Button
          size="sm"
          variant={tab === 'template' ? 'primary' : 'secondary'}
          role="tab"
          aria-selected={tab === 'template'}
          onClick={() => setTab('template')}
        >
          Настройка шаблона
        </Button>
      </div>

      {tab === 'list' ? <ApplicationsListTab /> : <TemplateSettingsTab />}
    </div>
  );
}

// --- Раздел «Заявки» (список) ---

function ApplicationsListTab() {
  const navigate = useNavigate();
  const [applications, setApplications] = useState<ApplicationSummary[]>([]);
  const [statusOptions, setStatusOptions] = useState<readonly StatusOption<string>[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Справочник статусов заявок загружаем один раз — для бейджей и фильтра.
  useEffect(() => {
    statusesApi
      .list()
      .then((response) =>
        setStatusOptions(
          response.statuses.map((status) => ({
            value: String(status.id),
            label: status.name,
            // Стабильный цвет по идентификатору статуса.
            tone: toneFromString(status.id.toString()),
          })),
        ),
      )
      .catch(() => undefined);
  }, []);

  const specs = useMemo<FilterSpec[]>(
    () => [
      {
        kind: 'multi-select',
        field: 'application',
        label: 'По заявке',
        placeholder: 'Название заявки…',
        loadOptions: async (search) => {
          const response = await applicationsApi.list({ search: search || undefined, limit: 20, offset: 0 });
          return response.applications.map((application) => ({ value: String(application.id), label: application.title }));
        },
      },
      {
        kind: 'multi-select',
        field: 'owner',
        label: 'По заявителю',
        placeholder: 'ФИО или email…',
        loadOptions: async (search) => {
          const response = await usersApi.list({
            roles: [Roles.applicant],
            search: search || undefined,
            limit: 20,
            offset: 0,
          });
          return response.users.map((user) => ({
            value: String(user.id),
            label: `${formatUserName(user)} (${user.email})`,
          }));
        },
      },
      {
        kind: 'checkbox-group',
        field: 'status',
        label: 'Статус заявки',
        options: statusOptions.map((status) => ({ value: status.value, label: status.label })),
      },
      {
        kind: 'multi-select',
        field: 'tender',
        label: 'Конкурс',
        placeholder: 'Название конкурса…',
        loadOptions: async (search) => {
          const response = await tendersApi.list();
          const needle = search.trim().toLowerCase();
          return response.tenders
            .filter((tender) => !needle || tender.name.toLowerCase().includes(needle))
            .map((tender) => ({ value: String(tender.id), label: tender.name }));
        },
      },
      { kind: 'date-range', field: 'created', label: 'Дата создания заявки', presets: true },
      { kind: 'date-range', field: 'updated', label: 'Дата изменения заявки', presets: true },
    ],
    [statusOptions],
  );

  const state = useDataViewState({ specs, defaultPageSize: 20 });
  const { query } = state;

  const load = useCallback(async () => {
    const statusIds = (query.filters.status as string[] | undefined) ?? [];
    const tenderIds = (query.filters.tender as string[] | undefined) ?? [];
    const ownerIds = (query.filters.owner as string[] | undefined) ?? [];
    const applicationIds = (query.filters.application as string[] | undefined) ?? [];
    const created = query.filters.created as DateRangeValue | undefined;
    const updated = query.filters.updated as DateRangeValue | undefined;

    setLoading(true);
    setError(null);
    try {
      const response = await applicationsApi.list({
        search: query.search || undefined,
        statusIds: statusIds.map(Number),
        tenderIds: tenderIds.map(Number),
        ownerIds: ownerIds.map(Number),
        applicationIds: applicationIds.map(Number),
        createdFrom: created?.from || undefined,
        createdTo: created?.to || undefined,
        updatedFrom: updated?.from || undefined,
        updatedTo: updated?.to || undefined,
        sort: query.sort?.field,
        order: query.sort?.direction,
        limit: query.pageSize,
        offset: (query.page - 1) * query.pageSize,
      });
      setApplications(response.applications);
      setTotal(response.total);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Не удалось загрузить заявки');
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    void load();
  }, [load]);

  const columns: TableColumn<ApplicationSummary>[] = [
    { key: 'title', header: 'Заявка', field: 'title' },
    { key: 'owner', header: 'Заявитель', render: (application) => application.ownerName },
    {
      key: 'status',
      header: 'Статус',
      width: '170px',
      render: (application) =>
        application.status ? (
          <StatusBadge value={String(application.status.id)} options={statusOptions} maxWidth={150} />
        ) : (
          <Badge tone="neutral">—</Badge>
        ),
    },
    { key: 'tender', header: 'Конкурс', render: (application) => application.tender ?? '—' },
    { key: 'updated_at', header: 'Обновлена', render: (application) => formatDateTime(application.updatedAt) },
    {
      key: 'actions',
      header: '',
      width: '80px',
      sortable: false,
      render: (application) => (
        <Button size="sm" variant="secondary" icon="eye" onClick={() => navigate(`/admin/applications/${application.id}`)}>
          Открыть
        </Button>
      ),
    },
  ];

  return (
    <Container
      title="Список заявок"
      actions={
        <Button icon="add" onClick={() => navigate('/admin/applications/new')}>
          Создать заявку
        </Button>
      }
    >
      <DataView
        state={state}
        mode="advanced"
        search={{ placeholder: 'Поиск по названию и заявителю' }}
        columns={columns}
        rows={applications}
        rowKey={(application) => application.id}
        total={total}
        loading={loading}
        error={error}
        onRetry={() => void load()}
        onRowClick={(application) => navigate(`/admin/applications/${application.id}`)}
        emptyText="Заявок не найдено"
      />

      <div className={styles.pageHint}>
        Заявитель подаёт заявки самостоятельно. При необходимости администратор может создать заявку за пользователя и модерировать существующие.
      </div>
    </Container>
  );
}

// --- Раздел «Настройка шаблона» (подсказки к разделам формы) ---

/** Ссылка на документ в тексте подсказки: `/api/documents/<id>/download` (с любым origin). */
const DOCUMENT_LINK_RE = /[ \t]*\[[^\]]*\]\((?:https?:\/\/[^)\s]*?)?\/api\/documents\/(\d+)\/download\)/g;

/** Отделяет свободный текст подсказки от ссылок на документы (для multi-select). */
function splitHint(text: string): { text: string; docIds: string[] } {
  const docIds: string[] = [];
  const cleaned = text
    .replace(DOCUMENT_LINK_RE, (_match, id: string) => {
      if (!docIds.includes(id)) docIds.push(id);
      return '';
    })
    .trim();
  return { text: cleaned, docIds };
}

/** Собирает итоговый текст подсказки: свободный текст + markdown-ссылки на выбранные документы. */
function composeHint(text: string, docIds: string[], documents: PublicDocument[]): string {
  const links = docIds.map((id) => {
    const document = documents.find((item) => String(item.id) === id);
    const title = document?.title ?? `Документ ${id}`;
    return `[${title}](${window.location.origin}${documentsApi.downloadUrl(Number(id))})`;
  });
  return [text.trim(), ...links].filter(Boolean).join(' ');
}

function TemplateSettingsTab() {
  const toast = useToast();
  const [drafts, setDrafts] = useState<Record<SectionHintKey, string>>(
    () => Object.fromEntries(SECTION_HINT_KEYS.map((key) => [key, ''])) as Record<SectionHintKey, string>,
  );
  const [selectedDocs, setSelectedDocs] = useState<Record<SectionHintKey, string[]>>(
    () => Object.fromEntries(SECTION_HINT_KEYS.map((key) => [key, [] as string[]])) as Record<SectionHintKey, string[]>,
  );
  const [documents, setDocuments] = useState<PublicDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingKey, setSavingKey] = useState<SectionHintKey | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([sectionHintsApi.list(), documentsApi.list()])
      .then(([hintsResponse, documentsResponse]) => {
        if (cancelled) return;
        const nextDrafts = {} as Record<SectionHintKey, string>;
        const nextSelected = {} as Record<SectionHintKey, string[]>;
        for (const key of SECTION_HINT_KEYS) {
          const parsed = splitHint(hintsResponse.hints.find((hint) => hint.sectionKey === key)?.text ?? '');
          nextDrafts[key] = parsed.text;
          nextSelected[key] = parsed.docIds;
        }
        setDrafts(nextDrafts);
        setSelectedDocs(nextSelected);
        setDocuments(documentsResponse.documents);
      })
      .catch((caught) => {
        if (!cancelled) setError(caught instanceof ApiError ? caught.message : 'Не удалось загрузить данные');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Асинхронный источник вариантов для multi-select (как в фильтрах DataView).
  const loadDocumentOptions = useCallback(
    async (search: string) => {
      const needle = search.trim().toLowerCase();
      return documents
        .filter((document) => !needle || document.title.toLowerCase().includes(needle))
        .map((document) => ({ value: String(document.id), label: document.title }));
    },
    [documents],
  );

  const save = async (key: SectionHintKey) => {
    setSavingKey(key);
    try {
      await sectionHintsApi.update(key, composeHint(drafts[key], selectedDocs[key], documents));
      toast.showToast({ message: `Подсказка раздела «${SECTION_LABELS[key]}» сохранена`, tone: 'success' });
    } catch (caught) {
      toast.showToast({ message: caught instanceof ApiError ? caught.message : 'Не удалось сохранить', tone: 'error' });
    } finally {
      setSavingKey(null);
    }
  };

  return (
    <Container title="Настройка шаблона">
      <p className={styles.pageHint}>
        Тексты подсказок к разделам формы заявки. Ссылки на документы выбираются ниже (из раздела
        «Документы») и добавляются в подсказку автоматически; в самом тексте ссылки можно задавать
        markdown-синтаксисом <code>[подпись](адрес)</code>.
      </p>

      {loading ? (
        <StateMessage state="loading" />
      ) : error ? (
        <StateMessage state="error" message={error} />
      ) : (
        <div className={styles.hintEditors}>
          {SECTION_HINT_KEYS.map((key) => (
            <div key={key} className={styles.hintEditor}>
              <div className={styles.hintEditorHead}>
                <strong>{SECTION_LABELS[key]}</strong>
                <Button size="sm" variant="secondary" icon="check" loading={savingKey === key} onClick={() => void save(key)}>
                  Сохранить
                </Button>
              </div>
              <Textarea
                label="Текст подсказки"
                value={drafts[key]}
                rows={3}
                onChange={(event) => setDrafts((prev) => ({ ...prev, [key]: event.target.value }))}
              />
              <MultiSelectFilter
                label="Ссылки на документы"
                placeholder="Найдите документ…"
                value={selectedDocs[key]}
                onChange={(value) => setSelectedDocs((prev) => ({ ...prev, [key]: value }))}
                loadOptions={loadDocumentOptions}
              />
            </div>
          ))}
        </div>
      )}
    </Container>
  );
}
