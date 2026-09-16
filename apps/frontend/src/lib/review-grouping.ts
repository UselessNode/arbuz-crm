// Группировка и агрегация строк таблицы экспертиз.
//
// Группировка — это преобразование данных над таблицей, а не её свойство:
// строки остаются теми же, меняется лишь их представление. Поэтому вся логика
// вынесена в чистые функции и покрыта смоук-тестом.
import type { SummaryReviewRow } from '../api/reviews-summary';

/**
 * Строка, с которой работает группировка. Совпадает со сводкой с сервера;
 * список экспертиз приводится к этой же форме (`toGroupingRow` в ReviewsPage),
 * чтобы правила группировки были одни и те же в обоих режимах.
 */
export type GroupingRow = SummaryReviewRow;

/** Доступные режимы группировки. */
export const ReviewGrouping = {
  none: 'none',
  expert: 'expert',
  verdict: 'verdict',
  score: 'score',
  date: 'date',
} as const;

export type ReviewGrouping = (typeof ReviewGrouping)[keyof typeof ReviewGrouping];

export const REVIEW_GROUPING_OPTIONS: ReadonlyArray<{ value: ReviewGrouping; label: string }> = [
  { value: ReviewGrouping.none, label: 'Без группировки' },
  { value: ReviewGrouping.expert, label: 'По эксперту' },
  { value: ReviewGrouping.verdict, label: 'По вердикту' },
  { value: ReviewGrouping.score, label: 'По оценке' },
  { value: ReviewGrouping.date, label: 'По дате' },
];

/** Проверка значения из URL: сужает строку до ReviewGrouping. */
export function isReviewGrouping(value: string): value is ReviewGrouping {
  return REVIEW_GROUPING_OPTIONS.some((option) => option.value === value);
}

/** Шаг диапазонов при группировке по оценке. */
export const SCORE_BUCKET_STEP = 5;

export interface GroupedRow {
  /** Ключ строки: id группы либо id экспертизы в режиме без группировки. */
  key: string;
  /** Значение группы — то, что уходит в отчёт. */
  selection: { expert_id: number } | { status_id: number } | { review_ids: number[] };
  label: string;
  /** id экспертиз, попавших в строку. */
  reviewIds: number[];
  rows: GroupingRow[];
  count: number;
  applications: number;
  averageScore: number | null;
}

/**
 * Сворачивает список экспертиз в строки таблицы.
 * `none` — одна строка на экспертизу, остальные режимы — одна строка на группу.
 */
export function groupReviews(reviews: GroupingRow[], grouping: ReviewGrouping): GroupedRow[] {
  if (grouping === ReviewGrouping.none) return reviews.map(singleRow);

  const groups = new Map<string, { selection: GroupedRow['selection']; label: string; rows: GroupingRow[] }>();
  for (const review of reviews) {
    const key = groupKey(review, grouping);
    const existing = groups.get(key.id);
    if (existing) existing.rows.push(review);
    else groups.set(key.id, { selection: key.selection, label: key.label, rows: [review] });
  }

  return [...groups.entries()].map(([id, group]) => ({
    key: id,
    selection: group.selection,
    label: group.label,
    reviewIds: group.rows.map((row) => row.id),
    rows: group.rows,
    count: group.rows.length,
    applications: new Set(group.rows.map((row) => row.applicationId)).size,
    averageScore: averageScore(group.rows),
  }));
}

/** Строка площадью в одну экспертизу (режим без группировки). */
function singleRow(review: GroupingRow): GroupedRow {
  return {
    key: `review-${review.id}`,
    selection: { review_ids: [review.id] },
    label: review.applicationTitle ?? `Заявка #${review.applicationId}`,
    reviewIds: [review.id],
    rows: [review],
    count: 1,
    applications: 1,
    averageScore: review.totalScore,
  };
}

/** Ключ группы: стабильный id (для чекбоксов) и подпись (для строки таблицы). */
function groupKey(
  review: GroupingRow,
  grouping: ReviewGrouping,
): { id: string; selection: GroupedRow['selection']; label: string } {
  switch (grouping) {
    case ReviewGrouping.expert:
      return {
        id: `expert-${review.expertId}`,
        selection: { expert_id: review.expertId },
        label: review.expertName,
      };
    case ReviewGrouping.verdict:
      return {
        id: `verdict-${review.verdictId ?? 'none'}`,
        // Вердикт без статуса в отчёт по вердикту не вынести — берём точный список.
        selection: review.verdictId !== null ? { status_id: review.verdictId } : { review_ids: [review.id] },
        label: review.verdictName ?? 'Вердикт не выставлен',
      };
    case ReviewGrouping.score: {
      const bucket = scoreBucket(review.totalScore);
      return {
        id: `score-${bucket.start}`,
        selection: { review_ids: [review.id] },
        label: `${bucket.start}–${bucket.end}`,
      };
    }
    case ReviewGrouping.date: {
      const period = monthPeriod(review.updatedAt);
      return { id: `date-${period.key}`, selection: { review_ids: [review.id] }, label: period.label };
    }
    default:
      return { id: `review-${review.id}`, selection: { review_ids: [review.id] }, label: '' };
  }
}

/** Диапазон оценки: 0–4, 5–9, … Оценка без балла попадает в отдельную группу. */
export function scoreBucket(score: number | null): { start: number; end: number; label: string } {
  if (score === null) return { start: -1, end: -1, label: 'Без оценки' };
  const start = Math.floor(score / SCORE_BUCKET_STEP) * SCORE_BUCKET_STEP;
  return { start, end: start + SCORE_BUCKET_STEP - 1, label: `${start}–${start + SCORE_BUCKET_STEP - 1}` };
}

const MONTHS = [
  'январь',
  'февраль',
  'март',
  'апрель',
  'май',
  'июнь',
  'июль',
  'август',
  'сентябрь',
  'октябрь',
  'ноябрь',
  'декабрь',
];

/** Период группировки по дате: месяц обновления экспертизы. */
export function monthPeriod(value: string | Date): { key: string; label: string } {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return { key: 'unknown', label: 'Дата неизвестна' };
  const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  return { key, label: `${MONTHS[date.getMonth()]} ${date.getFullYear()}` };
}

function averageScore(rows: GroupingRow[]): number | null {
  const scored = rows.filter((row) => row.totalScore !== null);
  if (scored.length === 0) return null;
  const sum = scored.reduce((total, row) => total + (row.totalScore ?? 0), 0);
  return Math.round((sum / scored.length) * 100) / 100;
}

/**
 * Критерий отбора для отчёта по выбранным строкам.
 * Одна строка — её собственный критерий (группа целиком), несколько — точный список экспертиз.
 */
export function selectionForRows(
  rows: GroupedRow[],
): { expert_id: number } | { status_id: number } | { review_ids: number[] } | null {
  if (rows.length === 0) return null;
  if (rows.length === 1) return rows[0].selection;
  const reviewIds = rows.flatMap((row) => row.reviewIds);
  return reviewIds.length > 0 ? { review_ids: reviewIds } : null;
}
