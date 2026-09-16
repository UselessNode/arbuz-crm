// Список экспертиз (админ): режимы таблицы, группировка, выбор строк и отчёты.
//
// Режимы:
//   0 — обычная таблица (как раньше);
//   1 — то же + чекбоксы для набора отчёта;
//   N — строки-группы (по эксперту / вердикту / оценке / дате); в каждой строке
//       набор экспертиз, который можно выгрузить одним отчётом.
// Группировка, поиск и фильтры живут в панели инструментов: таблица — представление,
// а не источник правил (см. `lib/review-grouping.ts`).
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Badge,
  Button,
  Container,
  EMPTY_DATE_RANGE,
  ListToolbar,
  RangeDatePicker,
  RangeSlider,
  SearchInput,
  Select,
  StateMessage,
  StatusBadge,
  Table,
  toBadgeTone,
} from '../../components/ui';
import type { DateRange, NumericRange, StatusOption, TableColumn } from '../../components/ui';
import { reviewsApi, type ReviewListItem } from '../../api/reviews';
import { reviewStatusesApi, type ReviewVerdict } from '../../api/references';
import { pdfExportApi } from '../../api/pdf-export';
import { usePdfExport } from '../../lib/use-pdf-export';
import { reviewsSummaryApi, type ReviewSummary, type ReviewSelection } from '../../api/reviews-summary';
import { ApiError } from '../../api/client';
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
  const [search, setSearch] = useState('');
  const [verdictFilter, setVerdictFilter] = useState('');
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [sort, setSort] = useState<SortState>(null);
  // Диапазоны — дополнительные фильтры; показываются только в своей группировке.
  const [scoreRange, setScoreRange] = useState<NumericRange | null>(null);
  const [dateRange, setDateRange] = useState<DateRange>(EMPTY_DATE_RANGE);
  const [summary, setSummary] = useState<ReviewSummary | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [reviewsResponse, statusesResponse] = await Promise.all([reviewsApi.list(), reviewStatusesApi.list()]);
      setReviews(reviewsResponse.reviews);
      setVerdicts(statusesResponse.statuses);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Не удалось загрузить экспертизы');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Вердикты — редактируемый справочник: метки и цвета берём с сервера.
  const verdictOptions: readonly StatusOption<string>[] = useMemo(
    () => verdicts.map((verdict) => ({ value: String(verdict.id), label: verdict.name, tone: toBadgeTone(verdict.tone) })),
    [verdicts],
  );

  // Границы диапазонов берём из данных: оценка нормируется от нуля до максимума в списке,
  // период — от самой ранней даты обновления до самой поздней.
  const scoreBounds = useMemo<NumericRange>(() => {
    const scores = reviews.map((review) => review.totalScore).filter((score): score is number => score !== null);
    return { from: 0, to: Math.max(...scores, 10) };
  }, [reviews]);

  const dateBounds = useMemo(() => {
    const days = reviews
      .map((review) => review.updatedAt.slice(0, 10))
      .filter((day) => /^\d{4}-\d{2}-\d{2}$/.test(day))
      .sort();
    return { min: days[0] ?? '', max: days[days.length - 1] ?? '' };
  }, [reviews]);

  // Активный диапазон: ползунок оценки — только для группировки по оценке,
  // период — только для группировки по дате. Пока пользователь не трогал диапазон,
  // он не фильтрует: выбор группировки не должен менять состав списка.
  const activeScoreRange = grouping === ReviewGrouping.score ? scoreRange : null;
  const activeDateRange = grouping === ReviewGrouping.date ? dateRange : EMPTY_DATE_RANGE;

  // Список небольшой (без пагинации) — фильтруем на клиенте.
  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return reviews.filter((review) => {
      if (verdictFilter && String(review.status?.id ?? '') !== verdictFilter) return false;
      if (activeScoreRange) {
        // Экспертизы без итогового балла в диапазон оценки не попадают.
        if (review.totalScore === null) return false;
        if (review.totalScore < activeScoreRange.from || review.totalScore > activeScoreRange.to) return false;
      }
      if (activeDateRange.from || activeDateRange.to) {
        const day = review.updatedAt.slice(0, 10);
        if (activeDateRange.from && day < activeDateRange.from) return false;
        if (activeDateRange.to && day > activeDateRange.to) return false;
      }
      if (!needle) return true;
      const haystack = [review.applicationTitle ?? '', review.expert ? formatUserName(review.expert) : ''].join(' ').toLowerCase();
      return haystack.includes(needle);
    });
  }, [reviews, search, verdictFilter, activeScoreRange, activeDateRange]);

  const rows = useMemo(() => groupReviews(filtered.map(toGroupingRow), grouping), [filtered, grouping]);

  // Данные сводки берём с сервера — тот же источник, что и PDF (`/api/reviews/summary`).
  useEffect(() => {
    if (!grouped) {
      setSummary(null);
      setSummaryError(null);
      return;
    }
    let cancelled = false;
    // Без фильтра вердикта отчёт строится по всей базе на сервере (`all`):
    // список экспертиз не пагинирован, но сводка не должна зависеть
    // от того, что успело загрузиться в браузер.
    const selection: ReviewSelection = verdictFilter
      ? { status_id: Number(verdictFilter) }
      : { all: true };
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
  }, [grouped, verdictFilter]);

  const sortedRows = useMemo(() => sortGroupedRows(rows, sort), [rows, sort]);
  const sortedReviews = useMemo(() => sortReviews(filtered, sort), [filtered, sort]);

  const setGrouping = (value: string) => {
    // Ключи строк в разных режимах имеют разную природу — выделение переносить некуда.
    setSelected(new Set());
    setSort(null);
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

  const openSummary = (query: Record<string, string>) => {
    navigate(`/admin/reviews/summary?${new URLSearchParams(query).toString()}`);
  };

  const columns: TableColumn<GroupedRow>[] = grouped
    ? [
        {
          key: 'group',
          header: GROUPING_HEADERS[grouping],
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
      ]
    : [
        { key: 'application', header: 'Заявка', render: (row) => row.rows[0].applicationTitle ?? `Заявка #${row.rows[0].applicationId}` },
        { key: 'expert', header: 'Эксперт', render: (row) => row.rows[0].expertName },
        {
          key: 'status',
          header: 'Вердикт',
          render: (row) =>
            row.rows[0].verdictId !== null ? (
              <StatusBadge value={String(row.rows[0].verdictId)} options={verdictOptions} />
            ) : (
              <Badge tone="neutral">—</Badge>
            ),
        },
        { key: 'score', header: 'Балл', width: '90px', render: (row) => row.rows[0].totalScore ?? '—' },
        { key: 'updated', header: 'Обновлена', render: (row) => formatDateTime(row.rows[0].updatedAt) },
      ];

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

      <ListToolbar>
        <SearchInput placeholder="Поиск по заявке и эксперту" onChange={setSearch} />
        <Select label="Вердикт" placeholder="Все вердикты" value={verdictFilter} onChange={setVerdictFilter} options={verdictOptions} />
        <Select
          label="Группировка"
          value={grouping}
          onChange={setGrouping}
          options={REVIEW_GROUPING_OPTIONS.map((option) => ({ value: option.value, label: option.label }))}
        />
        {/* Поля диапазонов появляются только в своей группировке. */}
        {grouping === ReviewGrouping.score ? (
          <>
            <RangeSlider
              label="Диапазон оценки"
              value={activeScoreRange ?? scoreBounds}
              onChange={(next) => setScoreRange(next)}
              min={scoreBounds.from}
              max={scoreBounds.to}
              step={1}
            />
            {scoreRange ? (
              <Button size="sm" variant="ghost" onClick={() => setScoreRange(null)}>
                Весь диапазон
              </Button>
            ) : null}
          </>
        ) : null}
        {grouping === ReviewGrouping.date ? (
          <>
            <RangeDatePicker
              label="Период обновления"
              value={dateRange}
              onChange={setDateRange}
              min={dateBounds.min || undefined}
              max={dateBounds.max || undefined}
            />
            {dateRange.from || dateRange.to ? (
              <Button size="sm" variant="ghost" onClick={() => setDateRange(EMPTY_DATE_RANGE)}>
                Весь период
              </Button>
            ) : null}
          </>
        ) : null}
      </ListToolbar>

      {grouped && summary ? <SummaryTotals summary={summary} /> : null}
      {summaryError ? <div className={styles.error}>{summaryError}</div> : null}

      {loading ? (
        <StateMessage state="loading" />
      ) : error ? (
        <StateMessage state="error" message={error} onRetry={() => void load()} />
      ) : (grouped ? sortedRows.length === 0 : sortedReviews.length === 0) ? (
        <StateMessage state="empty" message={reviews.length === 0 ? 'Экспертиз пока нет' : 'Ничего не найдено'} />
      ) : grouped ? (
        <>
          <Table
            columns={columns}
            data={sortedRows}
            rowKey={(row) => row.key}
            sortKey={sort?.key ?? null}
            sortDirection={sort?.direction ?? 'asc'}
            onSort={(key) => setSort((prev) => cycleSort(prev, key))}
            selection={{ isSelected: (row) => selected.has(row.key), onToggle: toggleGroupRow }}
          />
          <SelectionHint
            count={selectedCount}
            reviews={selectedReviewsCount}
            onClear={() => setSelected(new Set())}
          />
        </>
      ) : (
        <>
          <Table
            columns={reviewColumns(verdictOptions, openSummary)}
            data={sortedReviews}
            rowKey={(row) => row.id}
            // Как и раньше: клик по строке ведёт в заявку; сводка — отдельной кнопкой.
            onRowClick={(row) => navigate(`/admin/applications/${row.applicationId}`)}
            sortKey={sort?.key ?? null}
            sortDirection={sort?.direction ?? 'asc'}
            onSort={(key) => setSort((prev) => cycleSort(prev, key))}
            selection={{ isSelected: (row) => selected.has(String(row.id)), onToggle: toggleReviewRow }}
          />
          <SelectionHint count={selectedCount} reviews={selectedReviewsCount} onClear={() => setSelected(new Set())} />
        </>
      )}
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

/** asc → desc → без сортировки. */
function cycleSort(current: SortState, key: string): SortState {
  if (!current || current.key !== key) return { key, direction: 'asc' };
  if (current.direction === 'asc') return { key, direction: 'desc' };
  return null;
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
