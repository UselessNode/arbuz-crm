// Список рецензий (админ): все назначенные экспертизы по заявкам.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Container, ListToolbar, SearchInput, Select, StateMessage, StatusBadge, Table, VERDICT_OPTIONS } from '../../components/ui';
import type { TableColumn } from '../../components/ui';
import { reviewsApi, type ReviewListItem } from '../../api/reviews';
import { ApiError } from '../../api/client';
import { formatDateTime, formatUserName } from '../../lib/format';
import styles from './ReviewsPage.module.css';

export function ReviewsPage() {
  const navigate = useNavigate();
  const [reviews, setReviews] = useState<ReviewListItem[]>([]);
  const [search, setSearch] = useState('');
  const [verdictFilter, setVerdictFilter] = useState('');
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

  // Список небольшой (без пагинации) — фильтруем на клиенте.
  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return reviews.filter((review) => {
      const verdict = review.status ?? 'draft';
      if (verdictFilter && verdict !== verdictFilter) return false;
      if (!needle) return true;
      const haystack = [review.applicationTitle ?? '', review.expert ? formatUserName(review.expert) : ''].join(' ').toLowerCase();
      return haystack.includes(needle);
    });
  }, [reviews, search, verdictFilter]);

  const columns: TableColumn<ReviewListItem>[] = [
    { key: 'application', header: 'Заявка', render: (r) => r.applicationTitle ?? `Заявка #${r.applicationId}` },
    { key: 'expert', header: 'Эксперт', render: (r) => (r.expert ? formatUserName(r.expert) : '—') },
    {
      key: 'status',
      header: 'Вердикт',
      render: (r) => <StatusBadge value={r.status ?? 'draft'} options={VERDICT_OPTIONS} />,
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

      <ListToolbar>
        <SearchInput placeholder="Поиск по заявке и эксперту" onChange={setSearch} />
        <Select label="Вердикт" placeholder="Все вердикты" value={verdictFilter} onChange={setVerdictFilter} options={VERDICT_OPTIONS} />
      </ListToolbar>

      {loading ? (
        <StateMessage state="loading" />
      ) : error ? (
        <StateMessage state="error" message={error} onRetry={() => void load()} />
      ) : filtered.length === 0 ? (
        <StateMessage state="empty" message={reviews.length === 0 ? 'Рецензий пока нет' : 'Ничего не найдено'} />
      ) : (
        <Table columns={columns} data={filtered} rowKey={(r) => r.id} onRowClick={(r) => navigate(`/admin/applications/${r.applicationId}`)} />
      )}
    </Container>
  );
}
