// Список заявок (админ).
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge, Button, Container, ListToolbar, Pagination, SearchInput, Select, StateMessage, StatusBadge, Table } from '../../components/ui';
import { toneFromString } from '../../components/ui/Badge/Badge';
import type { SelectOption, StatusOption, TableColumn } from '../../components/ui';
import { applicationsApi, type ApplicationSummary } from '../../api/applications';
import { statusesApi, tendersApi } from '../../api/references';
import { ApiError } from '../../api/client';
import { formatDateTime } from '../../lib/format';
import { ApplicationFormModal } from './ApplicationFormModal';
import styles from './Applications.module.css';

const PAGE_SIZE_OPTIONS = [20, 50, 100] as const;

export function ApplicationsPage() {
  const navigate = useNavigate();
  const [applications, setApplications] = useState<ApplicationSummary[]>([]);
  const [statusOptions, setStatusOptions] = useState<readonly StatusOption<string>[]>([]);
  const [tenderOptions, setTenderOptions] = useState<readonly SelectOption<string>[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(PAGE_SIZE_OPTIONS[0]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [tenderFilter, setTenderFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [response, statuses, tenders] = await Promise.all([
        applicationsApi.list({
          limit: pageSize,
          offset: (page - 1) * pageSize,
          search: search || undefined,
          statusId: statusFilter ? Number(statusFilter) : undefined,
          tenderId: tenderFilter ? Number(tenderFilter) : undefined,
        }),
        statusesApi.list(),
        tendersApi.list(),
      ]);
      setApplications(response.applications);
      setTotal(response.total);
      // Статусы заявок — редактируемый справочник; метки и идентификаторы берём с сервера.
      setStatusOptions(
        statuses.statuses.map((status) => ({
          value: String(status.id),
          label: status.name,
          tone: toneFromString(status.id.toString()), // Стабильный цвет по идентификатору статуса
        })),
      );
      setTenderOptions(
        tenders.tenders.map((tender) => ({
          value: String(tender.id),
          label: tender.name,
        })),
      );
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Не удалось загрузить заявки');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, search, statusFilter, tenderFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const columns: TableColumn<ApplicationSummary>[] = [
    { key: 'title', header: 'Заявка', field: 'title' },
    { key: 'owner', header: 'Заявитель', render: (a) => a.ownerName, sortValue: (a) => a.ownerName ?? '' },
    {
      key: 'status',
      header: 'Статус',
      width: '170px',
      sortValue: (a) => a.status?.name ?? '',
      render: (a) =>
        a.status
          ? <StatusBadge value={String(a.status.id)} options={statusOptions} maxWidth={150} />
          : <Badge tone="neutral">—</Badge>,
    },
    { key: 'tender', header: 'Конкурс', render: (a) => a.tender ?? '—', sortValue: (a) => a.tender ?? '' },
    { key: 'updated', header: 'Обновлена', render: (a) => formatDateTime(a.updatedAt), sortValue: (a) => a.updatedAt },
    {
      key: 'actions',
      header: '',
      width: '80px',
      sortable: false,
      render: (a) => (
        <Button size="sm" variant="secondary" icon="eye" onClick={() => navigate(`/admin/applications/${a.id}`)}>
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
      <ListToolbar>
        <SearchInput
          placeholder="Поиск по названию и заявителю"
          onChange={(value) => {
            setSearch(value);
            setPage(1);
          }}
        />
        <Select
          label="Статус"
          placeholder="Все статусы"
          value={statusFilter}
          onChange={(value) => {
            setStatusFilter(value);
            setPage(1);
          }}
          options={statusOptions}
        />
        <Select
          label="Конкурс"
          placeholder="Все конкурсы"
          value={tenderFilter}
          onChange={(value) => {
            setTenderFilter(value);
            setPage(1);
          }}
          options={tenderOptions}
        />
      </ListToolbar>

      {loading ? (
        <StateMessage state="loading" />
      ) : error ? (
        <StateMessage state="error" message={error} onRetry={() => void load()} />
      ) : applications.length === 0 ? (
        <StateMessage state="empty" message="Заявок не найдено" />
      ) : (
        <>
          <Table columns={columns} data={applications} rowKey={(a) => a.id} onRowClick={(a) => navigate(`/admin/applications/${a.id}`)} />
          <Pagination
            page={page}
            pageSize={pageSize}
            total={total}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
            pageSizeOptions={PAGE_SIZE_OPTIONS}
          />
        </>
      )}
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
