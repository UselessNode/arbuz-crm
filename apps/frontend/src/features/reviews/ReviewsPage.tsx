// Список рецензий (админ): все назначенные экспертизы по заявкам.
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Container, StateMessage, StatusBadge, Table, VERDICT_OPTIONS } from '../../components/ui';
import type { StatusOption, TableColumn } from '../../components/ui';
import { reviewsApi, type ReviewListItem } from '../../api/reviews';
import { ApiError } from '../../api/client';
import { formatDateTime, formatUserName } from '../../lib/format';
import styles from './ReviewsPage.module.css';

const STATUS_FALLBACK: readonly StatusOption<string>[] = [{ value: 'draft', label: 'Черновик', tone: 'gray' }];

export function ReviewsPage() {
  const navigate = useNavigate();
  const [reviews, setReviews] = useState<ReviewListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await reviewsApi.list();
      setReviews(response.reviews);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Не удалось загрузить рецензии');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const columns: TableColumn<ReviewListItem>[] = [
    { key: 'application', header: 'Заявка', render: (r) => r.applicationTitle ?? `Заявка #${r.applicationId}` },
    { key: 'expert', header: 'Эксперт', render: (r) => (r.expert ? formatUserName(r.expert) : '—') },
    {
      key: 'status',
      header: 'Вердикт',
      render: (r) => {
        const options: readonly StatusOption<string>[] = r.status
          ? VERDICT_OPTIONS.filter((option) => option.value === r.status)
          : STATUS_FALLBACK;
        return <StatusBadge value={r.status ?? 'draft'} options={options.length ? options : STATUS_FALLBACK} />;
      },
    },
    { key: 'score', header: 'Балл', render: (r) => r.totalScore ?? '—' },
    { key: 'updated', header: 'Обновлена', render: (r) => formatDateTime(r.updatedAt) },
    {
      key: 'actions',
      header: '',
      width: '80px',
      render: (r) => (
        <Button size="sm" variant="secondary" icon="eye" onClick={() => navigate(`/admin/applications/${r.applicationId}`)}>
          Открыть
        </Button>
      ),
    },
  ];

  return (
    <Container title="Рецензии">
      <div className={styles.hint}>
        Назначение экспертов и выставление оценок выполняются в карточке заявки.
      </div>
      {loading ? (
        <StateMessage state="loading" />
      ) : error ? (
        <StateMessage state="error" message={error} onRetry={() => void load()} />
      ) : reviews.length === 0 ? (
        <StateMessage state="empty" message="Рецензий пока нет" />
      ) : (
        <Table columns={columns} data={reviews} rowKey={(r) => r.id} onRowClick={(r) => navigate(`/admin/applications/${r.applicationId}`)} />
      )}
    </Container>
  );
}
