// Страница сводки по экспертизам (админ): данные и PDF из одного источника
// (`/api/reviews/summary` + `/api/reviews/pdf-export`).
//
// Открывается по ссылке, а не в модалке: адрес можно передать коллеге,
// обновление страницы не теряет состояние.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Badge, Button, Container, StateMessage, Table, toBadgeTone } from '../../components/ui';
import type { TableColumn } from '../../components/ui';
import { reviewsSummaryApi, type ReviewSelection, type ReviewSummary, type SummaryReviewRow } from '../../api/reviews-summary';
import { pdfExportApi } from '../../api/pdf-export';
import { usePdfExport } from '../../lib/use-pdf-export';
import { ApiError } from '../../api/client';
import { formatDateTime } from '../../lib/format';
import styles from './ReviewsSummaryPage.module.css';

export function ReviewsSummaryPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [summary, setSummary] = useState<ReviewSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Критерий отбора приходит из адреса: ?expert_id=… | ?status_id=… | ?application_id=… | ?review_ids=…
  const selection = useMemo<ReviewSelection | null>(() => {
    const expertId = searchParams.get('expert_id');
    const statusId = searchParams.get('status_id');
    const applicationId = searchParams.get('application_id');
    const reviewIds = searchParams.get('review_ids');
    if (expertId) return { expert_id: Number(expertId) };
    if (statusId) return { status_id: Number(statusId) };
    if (applicationId) return { application_id: Number(applicationId) };
    if (reviewIds) {
      const ids = reviewIds
        .split(',')
        .map((raw) => Number(raw))
        .filter((value) => Number.isInteger(value) && value > 0);
      return ids.length > 0 ? { review_ids: ids } : null;
    }
    return null;
  }, [searchParams]);

  const load = useCallback(async () => {
    if (!selection) {
      setError('Не задан критерий отбора');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await reviewsSummaryApi.get(selection);
      setSummary(response.summary);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Не удалось загрузить сводку');
    } finally {
      setLoading(false);
    }
  }, [selection]);

  useEffect(() => {
    void load();
  }, [load]);

  const startReport = useCallback(async () => {
    if (!selection) throw new Error('Нечего выгружать');
    const { job } = await pdfExportApi.startReviews({ ...selection, label: summary?.title ?? null });
    return job;
  }, [selection, summary]);

  const { busy, run } = usePdfExport({ start: startReport, errorMessage: 'Не удалось сформировать отчёт' });

  const columns: TableColumn<SummaryReviewRow>[] = [
    { key: 'application', header: 'Заявка', render: (row) => row.applicationTitle ?? `Заявка #${row.applicationId}` },
    { key: 'expert', header: 'Эксперт', render: (row) => row.expertName },
    {
      key: 'verdict',
      header: 'Вердикт',
      render: (row) => <Badge tone={toBadgeTone(row.verdictTone)}>{row.verdictName ?? '—'}</Badge>,
    },
    {
      key: 'score',
      header: 'Итоговый балл',
      width: '130px',
      render: (row) => (row.totalScore === null ? '—' : row.totalScore.toLocaleString('ru-RU')),
    },
    { key: 'updated', header: 'Обновлена', width: '170px', render: (row) => formatDateTime(row.updatedAt) },
    {
      key: 'comment',
      header: 'Комментарий эксперта',
      render: (row) => <span className={styles.comment}>{row.text ?? '—'}</span>,
    },
  ];

  return (
    <Container
      title="Сводка по экспертизам"
      actions={
        <>
          <Button variant="secondary" icon="arrow-left" onClick={() => navigate('/admin/reviews')}>
            К списку
          </Button>
          <Button icon="download" loading={busy} disabled={!summary} onClick={() => void run()}>
            {busy ? 'Готовим отчёт…' : 'Скачать PDF'}
          </Button>
        </>
      }
    >
      {loading ? (
        <StateMessage state="loading" />
      ) : error ? (
        <StateMessage state="error" message={error} onRetry={() => void load()} />
      ) : !summary ? (
        <StateMessage state="empty" message="Нет данных" />
      ) : (
        <div className={styles.page}>
          <div className={styles.head}>
            <h2 className={styles.title}>{summary.title}</h2>
            {summary.subtitle ? <div className={styles.subtitle}>{summary.subtitle}</div> : null}
          </div>

          <div className={styles.totals}>
            <span>
              Экспертиз: <strong>{summary.totals.reviews}</strong>
            </span>
            <span>
              Заявок: <strong>{summary.totals.applications}</strong>
            </span>
            <span>
              Экспертов: <strong>{summary.totals.experts}</strong>
            </span>
            <span>
              Средний балл: <strong>{summary.totals.averageScore ?? '—'}</strong>
            </span>
          </div>

          {summary.totals.verdictCounts.length > 0 ? (
            <div className={styles.badges}>
              {summary.totals.verdictCounts.map((verdict) => (
                <Badge key={verdict.id} tone={toBadgeTone(verdict.tone)}>
                  {verdict.name}: {verdict.count}
                </Badge>
              ))}
            </div>
          ) : null}

          {summary.criteriaAverages.length > 0 ? (
            <section className={styles.section}>
              <h3 className={styles.sectionTitle}>Средние по критериям</h3>
              <Table
                columns={[
                  { key: 'criterion', header: 'Критерий', field: 'name' },
                  { key: 'weight', header: 'Вес', width: '90px', render: (row) => row.weight },
                  {
                    key: 'average',
                    header: 'Средний балл',
                    width: '140px',
                    render: (row) => row.averageScore.toLocaleString('ru-RU'),
                  },
                ]}
                data={summary.criteriaAverages}
                rowKey={(row) => row.criterionId}
              />
            </section>
          ) : null}

          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Экспертизы ({summary.reviews.length})</h3>
            {summary.reviews.length === 0 ? (
              <StateMessage state="empty" message="Под условия отбора не подошла ни одна экспертиза" />
            ) : (
              <Table columns={columns} data={summary.reviews} rowKey={(row) => row.id} />
            )}
          </section>
        </div>
      )}
    </Container>
  );
}
