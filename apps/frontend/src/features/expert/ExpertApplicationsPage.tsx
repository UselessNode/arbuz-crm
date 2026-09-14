// Раздел эксперта: список назначенных на экспертизу заявок.
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge, Button, Container, Pagination, StateMessage, StatusBadge, Table, toBadgeTone } from '../../components/ui';
import type { StatusOption, TableColumn } from '../../components/ui';
import { applicationsApi, type ApplicationSummary } from '../../api/applications';
import { statusesApi } from '../../api/references';
import { ApiError } from '../../api/client';
import { formatDateTime } from '../../lib/format';

const PAGE_SIZE_OPTIONS = [20, 50, 100] as const;

export function ExpertApplicationsPage() {
  const navigate = useNavigate();
  const [applications, setApplications] = useState<ApplicationSummary[]>([]);
  const [statusOptions, setStatusOptions] = useState<readonly StatusOption<string>[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(PAGE_SIZE_OPTIONS[0]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [response, statuses] = await Promise.all([
        applicationsApi.list({ limit: pageSize, offset: (page - 1) * pageSize }),
        statusesApi.list(),
      ]);
      setApplications(response.applications);
      setTotal(response.total);
      setStatusOptions(statuses.statuses.map((status) => ({ value: String(status.id), label: status.name, tone: 'blue' })));
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Не удалось загрузить заявки');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize]);

  useEffect(() => {
    void load();
  }, [load]);

  const columns: TableColumn<ApplicationSummary>[] = [
    { key: 'title', header: 'Заявка', field: 'title' },
    {
      key: 'status',
      header: 'Статус заявки',
      render: (a) =>
        a.status ? <StatusBadge value={String(a.status.id)} options={statusOptions} /> : <Badge tone="neutral">—</Badge>,
    },
    {
      key: 'verdict',
      header: 'Мой вердикт',
      render: (a) =>
        a.verdict ? <Badge tone={toBadgeTone(a.verdict.tone)}>{a.verdict.name}</Badge> : <Badge tone="neutral">—</Badge>,
    },
    { key: 'tender', header: 'Конкурс', render: (a) => a.tender ?? '—' },
    { key: 'updated', header: 'Обновлена', render: (a) => formatDateTime(a.updatedAt) },
    {
      key: 'actions',
      header: '',
      width: '90px',
      render: (a) => (
        <Button size="sm" variant="secondary" icon="eye" onClick={() => navigate(`/expert/applications/${a.id}`)}>
          Открыть
        </Button>
      ),
    },
  ];

  return (
    <Container title="Назначенные заявки">
      {loading ? (
        <StateMessage state="loading" />
      ) : error ? (
        <StateMessage state="error" message={error} onRetry={() => void load()} />
      ) : applications.length === 0 ? (
        <StateMessage state="empty" message="Вам пока не назначены заявки" />
      ) : (
        <>
          <Table
            columns={columns}
            data={applications}
            rowKey={(a) => a.id}
            onRowClick={(a) => navigate(`/expert/applications/${a.id}`)}
          />
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
    </Container>
  );
}
