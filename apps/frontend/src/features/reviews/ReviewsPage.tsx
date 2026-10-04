// Список экспертиз (админ): фильтры, режимы таблицы, группировка, выбор строк и отчёты.
//
// Панель управления — общий `DataView` (поиск/фильтры/чипы/сортировка/URL). Группировка —
// отдельный режим (селект в панели), таблица остаётся представлением, не источником правил
// (см. `lib/review-grouping.ts`).
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Badge,
  Button,
  Container,
  DataView,
  Select,
  StatusBadge,
  toBadgeTone,
  useDataViewState,
} from '../../components/ui';
import type { DateRangeValue, FilterSpec, RangeValue, StatusOption, TableColumn } from '../../components/ui';
import { reviewsApi, type ReviewListItem } from '../../api/reviews';
import { reviewStatusesApi, type ReviewVerdict } from '../../api/references';
import { applicationsApi } from '../../api/applications';
import { usersApi } from '../../api/users';
import { pdfExportApi } from '../../api/pdf-export';
import { usePdfExport } from '../../lib/use-pdf-export';
import { reviewsSummaryApi, type ReviewSummary, type ReviewSelection } from '../../api/reviews-summary';
import { ApiError } from '../../api/client';
import { Roles } from '../../lib/roles';
import { formatDateTime, formatUserName } from '../../lib/format';
import {
  REVIEW_GROUPING_OPTIONS,
  ReviewGrouping,
  groupReviews,
  isReviewGrouping,
  selectionForRows,
  type GroupedRow,
  type GroupingRow,
} from '../../lib/review-grouping';
import styles from './ReviewsPage.module.css';

type SortState = { key: string; direction: 'asc' | 'desc' } | null;

/** Максимум слайдера балла по умолчанию (если в данных нет больших оценок). */
const SCORE_FALLBACK_MAX = 100;

/**
 * Приводит строку списка к форме, которой оперирует группировка.
 * Сводка с сервера отдаёт те же поля плюс конкурс/направление (см. `SummaryReviewRow`).
 */
function toGroupingRow(review: ReviewListItem): GroupingRow {
  return {
    id: review.id,
    applicationId: review.applicationId,
    applicationTitle: review.applicationTitle,
    tender: null,
    direction: null,
    expertId: review.expert?.id ?? 0,
    expertName: review.expert ? formatUserName(review.expert) : '—',
    verdictId: review.status?.id ?? null,
    verdictName: review.status?.name ?? null,
    verdictTone: review.status?.tone ?? null,
    totalScore: review.totalScore,
    text: review.text,
    rating: {}, // в списке нет оценок по критериям — они приходят только в сводке
    updatedAt: review.updatedAt,
  };
}

export function ReviewsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const grouping: ReviewGrouping = (() => {
    const raw = searchParams.get('group') ?? ReviewGrouping.none;
    return isReviewGrouping(raw) ? raw : ReviewGrouping.none;
  })();
  const grouped = grouping !== ReviewGrouping.none;

  const [reviews, setReviews] = useState<ReviewListItem[]>([]);
  const [verdicts, setVerdicts] = useState<ReviewVerdict[]>([]);
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [summary, setSummary] = useState<ReviewSummary | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Вердикты — редактируемый справочник: метки и цвета берём с сервера (один раз).
  useEffect(() => {
    reviewStatusesApi
      .list()
      .then((response) => setVerdicts(response.statuses))
      .catch(() => undefined);
  }, []);

  const verdictOptions = useMemo<readonly StatusOption<string>[]>(
    () => verdicts.map((verdict) => ({ value: String(verdict.id), label: verdict.name, tone: toBadgeTone(verdict.tone) })),
    [verdicts],
  );

  const scoreMax = useMemo(
    () => Math.max(SCORE_FALLBACK_MAX, ...reviews.map((review) => review.totalScore ?? 0), 0),
    [reviews],
  );

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
        field: 'expert',
        label: 'По эксперту',
        placeholder: 'ФИО или email…',
        loadOptions: async (search) => {
          const response = await usersApi.list({
            roles: [Roles.expert],
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
        label: 'Статус экспертизы',
        options: verdicts.map((verdict) => ({ value: String(verdict.id), label: verdict.name })),
      },
      { kind: 'range', field: 'score', label: 'Балл', min: 0, max: scoreMax, step: 1 },
      { kind: 'date-range', field: 'created', label: 'Дата создания', presets: true },
      { kind: 'date-range', field: 'updated', label: 'Дата изменения', presets: true },
    ],
    [verdicts, scoreMax],
  );

  const state = useDataViewState({ specs, defaultPageSize: 50 });
  const { query } = state;

  const load = useCallback(async () => {
    const statusIds = (query.filters.status as string[] | undefined) ?? [];
    const expertIds = (query.filters.expert as string[] | undefined) ?? [];
    const applicationIds = (query.filters.application as string[] | undefined) ?? [];
    const score = query.filters.score as RangeValue | undefined;
    const created = query.filters.created as DateRangeValue | undefined;
    const updated = query.filters.updated as DateRangeValue | undefined;

    setLoading(true);
    setError(null);
    try {
      // Список грузим целиком (без пагинации): группировка и выбор отчёта работают по всему набору.
      const response = await reviewsApi.list({
        search: query.search || undefined,
        statusIds: statusIds.map(Number),
        expertIds: expertIds.map(Number),
        applicationIds: applicationIds.map(Number),
        scoreMin: score?.min ?? undefined,
        scoreMax: score?.max ?? undefined,
        createdFrom: created?.from || undefined,
        createdTo: created?.to || undefined,
        updatedFrom: updated?.from || undefined,
        updatedTo: updated?.to || undefined,
      });
      setReviews(response.reviews);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Не удалось загрузить экспертизы');
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    void load();
  }, [load]);

  // Сортировка — клиентская (групповые метрики не сортируются на сервере); ключ/направление берём из URL.
  const sort: SortState = query.sort ? { key: query.sort.field, direction: query.sort.direction } : null;

  const rows = useMemo(() => groupReviews(reviews.map(toGroupingRow), grouping), [reviews, grouping]);
  const sortedRows = useMemo(() => sortGroupedRows(rows, sort), [rows, sort]);
  const sortedReviews = useMemo(() => sortReviews(reviews, sort), [reviews, sort]);

  // Данные сводки — с сервера: по активным фильтрам или по всей базе (тот же источник, что и PDF).
  useEffect(() => {
    if (!grouped) {
      setSummary(null);
      setSummaryError(null);
      return;
    }
    let cancelled = false;
    const selection: ReviewSelection = state.hasActiveFilters ? { review_ids: reviews.map((review) => review.id) } : { all: true };
    reviewsSummaryApi
      .get(selection)
      .then(({ summary: value }) => {
        if (!cancelled) {
          setSummary(value);
          setSummaryError(null);
        }
      })
      .catch((caught) => {
        if (!cancelled) setSummaryError(caught instanceof ApiError ? caught.message : 'Не удалось загрузить сводку');
      });
    return () => {
      cancelled = true;
    };
  }, [grouped, state.hasActiveFilters, reviews]);

  const setGrouping = (value: string) => {
    // Ключи строк в разных режимах имеют разную природу — выделение переносить некуда.
    setSelected(new Set());
    const next = new URLSearchParams(searchParams);
    if (value === ReviewGrouping.none) next.delete('group');
    else next.set('group', value);
    setSearchParams(next, { replace: true });
  };

  const toggleGroupRow = useCallback((row: GroupedRow) => {
    setSelected((prev) => toggle(prev, row.key));
  }, []);

  const toggleReviewRow = useCallback((row: ReviewListItem) => {
    setSelected((prev) => toggle(prev, String(row.id)));
  }, []);

  const selectedGroupRows = useMemo(() => sortedRows.filter((row) => selected.has(row.key)), [sortedRows, selected]);
  const selectedReviews = useMemo(
    () => sortedReviews.filter((review) => selected.has(String(review.id))),
    [sortedReviews, selected],
  );

  // Критерий отбора для отчёта: одна строка — её группа целиком, несколько — точный набор.
  const selection: ReviewSelection | null = grouped
    ? selectionForRows(selectedGroupRows)
    : selectedReviews.length > 0
      ? { review_ids: selectedReviews.map((review) => review.id) }
      : null;

  const selectedCount = grouped ? selectedGroupRows.length : selectedReviews.length;
  const selectedReviewsCount = grouped
    ? selectedGroupRows.reduce((sum, row) => sum + row.count, 0)
    : selectedReviews.length;

  const startReport = useCallback(async () => {
    if (!selection) throw new Error('Ничего не выбрано');
    const label =
      selectedCount === 1 && grouped ? selectedGroupRows[0].label : `Выборка: ${selectedReviewsCount} экспертиз`;
    const { job } = await pdfExportApi.startReviews({ ...selection, label });
    return job;
  }, [selection, selectedCount, selectedGroupRows, selectedReviewsCount, grouped]);

  const { busy, run } = usePdfExport({ start: startReport, errorMessage: 'Не удалось сформировать отчёт' });

  const openSummary = (query2: Record<string, string>) => {
    navigate(`/admin/reviews/summary?${new URLSearchParams(query2).toString()}`);
  };

  const groupedColumns: TableColumn<GroupedRow>[] = [
    {
      key: 'group',
      header: GROUPING_HEADERS[grouping as Exclude<ReviewGrouping, 'none'>],
      render: (row) => <span className={styles.groupLabel}>{row.label}</span>,
    },
    { key: 'count', header: 'Экспертиз', width: '110px', render: (row) => row.count },
    { key: 'applications', header: 'Заявок', width: '100px', render: (row) => row.applications },
    {
      key: 'average',
      header: 'Средний балл',
      width: '140px',
      render: (row) => (row.averageScore === null ? '—' : row.averageScore.toLocaleString('ru-RU')),
    },
    {
      key: 'verdicts',
      header: 'Вердикты',
      sortable: false,
      render: (row) => <VerdictList rows={row.rows} verdictOptions={verdictOptions} />,
    },
    {
      key: 'actions',
      header: '',
      width: '120px',
      sortable: false,
      render: (row) => (
        <Button size="sm" variant="secondary" icon="eye" onClick={() => openSummary(selectionQuery(row))}>
          Сводка
        </Button>
      ),
    },
  ];

  const toolbarExtras = (
    <Select
      label="Группировка"
      value={grouping}
      onChange={setGrouping}
      options={REVIEW_GROUPING_OPTIONS.map((option) => ({ value: option.value, label: option.label }))}
    />
  );

  return (
    <Container
      title="Экспертизы"
      actions={
        <Button
          icon="download"
          loading={busy}
          disabled={!selection}
          onClick={() => void run()}
          title={selection ? undefined : 'Отметьте строки, чтобы собрать отчёт'}
        >
          {busy ? 'Готовим отчёт…' : `Создать отчёт${selectedCount ? ` (${selectedReviewsCount})` : ''}`}
        </Button>
      }
    >
      <div className={styles.hint}>
        Вердикты и оценки выставляются экспертами; назначение экспертов и финальный статус — в карточке заявки.
      </div>

      {grouped && summary ? <SummaryTotals summary={summary} /> : null}
      {summaryError ? <div className={styles.error}>{summaryError}</div> : null}

      {grouped ? (
        <DataView<GroupedRow>
          state={state}
          mode="advanced"
          search={{ placeholder: 'Поиск по заявке и эксперту' }}
          toolbarExtras={toolbarExtras}
          columns={groupedColumns}
          rows={sortedRows}
          rowKey={(row) => row.key}
          total={sortedRows.length}
          paginated={false}
          loading={loading}
          error={error}
          onRetry={() => void load()}
          selection={{ isSelected: (row) => selected.has(row.key), onToggle: toggleGroupRow }}
          emptyText="Экспертиз пока нет"
          noResultsText="Ничего не найдено"
        />
      ) : (
        <DataView<ReviewListItem>
          state={state}
          mode="advanced"
          search={{ placeholder: 'Поиск по заявке и эксперту' }}
          toolbarExtras={toolbarExtras}
          columns={reviewColumns(verdictOptions, openSummary)}
          rows={sortedReviews}
          rowKey={(row) => row.id}
          total={sortedReviews.length}
          paginated={false}
          loading={loading}
          error={error}
          onRetry={() => void load()}
          onRowClick={(row) => navigate(`/admin/applications/${row.applicationId}`)}
          selection={{ isSelected: (row) => selected.has(String(row.id)), onToggle: toggleReviewRow }}
          emptyText="Экспертиз пока нет"
          noResultsText="Ничего не найдено"
        />
      )}

      <SelectionHint count={selectedCount} reviews={selectedReviewsCount} onClear={() => setSelected(new Set())} />
    </Container>
  );
}

/** Колонки режима «по записям»: строка — конкретная экспертиза. */
function reviewColumns(verdictOptions: readonly StatusOption<string>[], openSummary: (query: Record<string, string>) => void): TableColumn<ReviewListItem>[] {
  return [
    { key: 'application', header: 'Заявка', render: (row) => row.applicationTitle ?? `Заявка #${row.applicationId}` },
    { key: 'expert', header: 'Эксперт', render: (row) => (row.expert ? formatUserName(row.expert) : '—') },
    {
      key: 'status',
      header: 'Вердикт',
      render: (row) =>
        row.status ? <StatusBadge value={String(row.status.id)} options={verdictOptions} /> : <Badge tone="neutral">—</Badge>,
    },
    { key: 'score', header: 'Балл', width: '90px', render: (row) => row.totalScore ?? '—' },
    { key: 'updated', header: 'Обновлена', render: (row) => formatDateTime(row.updatedAt) },
    {
      key: 'actions',
      header: '',
      width: '120px',
      sortable: false,
      render: (row) => (
        <Button
          size="sm"
          variant="secondary"
          icon="eye"
          onClick={() => openSummary({ application_id: String(row.applicationId) })}
        >
          Сводка
        </Button>
      ),
    },
  ];
}

/** Подсказка о выделении с кнопкой сброса. */
function SelectionHint({ count, reviews, onClear }: { count: number; reviews: number; onClear: () => void }) {
  if (count === 0) return null;
  return (
    <div className={styles.selectionHint}>
      Выбрано строк: <strong>{count}</strong> · экспертиз в отчёт: <strong>{reviews}</strong>
      <Button size="sm" variant="ghost" onClick={onClear}>
        Снять выделение
      </Button>
    </div>
  );
}

const GROUPING_HEADERS: Record<Exclude<ReviewGrouping, 'none'>, string> = {
  expert: 'Эксперт',
  verdict: 'Вердикт',
  score: 'Диапазон оценки',
  date: 'Период',
};

/** Итоги сводки — те же данные, что попадут в PDF. */
function SummaryTotals({ summary }: { summary: ReviewSummary }) {
  return (
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
      {summary.totals.verdictCounts.map((verdict) => (
        <Badge key={verdict.id} tone={toBadgeTone(verdict.tone)}>
          {verdict.name}: {verdict.count}
        </Badge>
      ))}
    </div>
  );
}

/** Вердикты внутри группы: бейдж тона вердикта с количеством. */
function VerdictList({ rows, verdictOptions }: { rows: Array<{ verdictId: number | null }>; verdictOptions: readonly StatusOption<string>[] }) {
  const counts = new Map<number, number>();
  for (const row of rows) {
    if (row.verdictId === null) continue;
    counts.set(row.verdictId, (counts.get(row.verdictId) ?? 0) + 1);
  }
  if (counts.size === 0) return <Badge tone="neutral">—</Badge>;
  return (
    <div className={styles.verdictList}>
      {[...counts.entries()].map(([id, count]) => {
        const option = verdictOptions.find((candidate) => candidate.value === String(id));
        return (
          <Badge key={id} tone={option?.tone ?? 'neutral'}>
            {option?.label ?? `Вердикт #${id}`}: {count}
          </Badge>
        );
      })}
    </div>
  );
}

/** Параметры для ссылки на страницу сводки по строке таблицы. */
function selectionQuery(row: GroupedRow): Record<string, string> {
  if ('expert_id' in row.selection) return { group: 'expert', expert_id: String(row.selection.expert_id) };
  if ('status_id' in row.selection) return { group: 'verdict', status_id: String(row.selection.status_id) };
  return { review_ids: row.selection.review_ids.join(',') };
}

function toggle(prev: ReadonlySet<string>, key: string): ReadonlySet<string> {
  const next = new Set(prev);
  if (next.has(key)) next.delete(key);
  else next.add(key);
  return next;
}

/** Сортировка агрегатных строк по активной колонке. */
function sortGroupedRows(rows: GroupedRow[], sort: SortState): GroupedRow[] {
  if (!sort) return rows;
  const value = (row: GroupedRow): string | number => {
    switch (sort.key) {
      case 'group':
        return row.label.toLowerCase();
      case 'count':
        return row.count;
      case 'applications':
        return row.applications;
      case 'average':
        return row.averageScore ?? -1;
      default:
        return row.key;
    }
  };
  return sortBy(rows, value, sort.direction);
}

/** Сортировка строк режима «по записям». */
function sortReviews(rows: ReviewListItem[], sort: SortState): ReviewListItem[] {
  if (!sort) return rows;
  const value = (row: ReviewListItem): string | number => {
    switch (sort.key) {
      case 'application':
        return (row.applicationTitle ?? '').toLowerCase();
      case 'expert':
        return (row.expert ? formatUserName(row.expert) : '').toLowerCase();
      case 'status':
        return row.status?.name ?? '';
      case 'score':
        return row.totalScore ?? -1;
      case 'updated':
        return new Date(row.updatedAt).getTime();
      default:
        return row.id;
    }
  };
  return sortBy(rows, value, sort.direction);
}

function sortBy<T>(rows: T[], value: (row: T) => string | number, direction: 'asc' | 'desc'): T[] {
  const factor = direction === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    const left = value(a);
    const right = value(b);
    if (typeof left === 'number' && typeof right === 'number') return (left - right) * factor;
    return String(left).localeCompare(String(right), 'ru') * factor;
  });
}
