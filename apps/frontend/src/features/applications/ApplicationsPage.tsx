// Список заявок (админ): поиск, фасетные фильтры, серверная сортировка и пагинация через DataView.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge, Button, Container, DataView, StatusBadge, useDataViewState } from '../../components/ui';
import type { DateRangeValue, FilterSpec, StatusOption, TableColumn } from '../../components/ui';
import { toneFromString } from '../../components/ui/Badge/Badge';
import { applicationsApi, type ApplicationSummary } from '../../api/applications';
import { statusesApi, tendersApi } from '../../api/references';
import { usersApi } from '../../api/users';
import { ApiError } from '../../api/client';
import { formatDateTime, formatUserName } from '../../lib/format';
import { Roles } from '../../lib/roles';
import { ApplicationFormModal } from './ApplicationFormModal';
import styles from './Applications.module.css';

export function ApplicationsPage() {
  const navigate = useNavigate();
  const [applications, setApplications] = useState<ApplicationSummary[]>([]);
  const [statusOptions, setStatusOptions] = useState<readonly StatusOption<string>[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

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
      title="Заявки"
      actions={
        <Button icon="add" onClick={() => setCreating(true)}>
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

      <ApplicationFormModal
        open={creating}
        mode="create"
        canAssignOwner
        onClose={() => setCreating(false)}
        onSaved={(created) => {
          if (created) navigate(`/admin/applications/${created.id}`);
        }}
      />
    </Container>
  );
}
