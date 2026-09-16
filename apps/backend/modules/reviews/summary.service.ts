// Сводка по экспертизам — единый источник данных для таблицы (режим с группировкой),
// страницы сводки и PDF-отчёта. Рендер PDF не должен собирать данные самостоятельно,
// иначе сводка и документ разойдутся (см. «PDF должен совпасть с интерфейсом» в техдолге).
import { RoleType } from '@arbuz/shared';
import { prisma } from '../../lib/prisma';
import { httpError } from '../../lib/http';
import type { CurrentUser } from '../files/files.service';

/** Сводка — администраторская функциональность (агрегат пересекает заявки). */
export function requireAdmin(actor: CurrentUser): void {
  if (actor.role !== RoleType.admin) {
    throw httpError(403, 'Сводки доступны только администратору', 'FORBIDDEN');
  }
}

/** Критерий отбора экспертиз (совпадает с params задания на генерацию PDF). */
export type ReviewSelectionParams =
  | { expert_id: number }
  | { status_id: number }
  | { application_id: number }
  | { review_ids: number[] }
  /** Без критерия — все экспертизы (только для админа, сводка по всей базе). */
  | { all: true };

export interface SummaryCriterionAverage {
  criterionId: number;
  name: string;
  averageScore: number;
  weight: number;
}

/** Одна экспертиза в сводке. */
export interface SummaryReviewRow {
  id: number;
  applicationId: number;
  applicationTitle: string | null;
  tender: string | null;
  direction: string | null;
  expertId: number;
  expertName: string;
  verdictId: number | null;
  verdictName: string | null;
  verdictTone: string | null;
  totalScore: number | null;
  text: string | null;
  /** Оценки по критериям: { criterionId: value }. */
  rating: Record<string, number>;
  updatedAt: Date;
}

export interface ReviewSummary {
  /** Тип выборки — из него выводится заголовок отчёта. */
  kind: 'expert' | 'verdict' | 'application' | 'selection';
  title: string;
  subtitle: string | null;
  reviews: SummaryReviewRow[];
  totals: {
    reviews: number;
    applications: number;
    experts: number;
    averageScore: number | null;
    /** Распределение по вердиктам: id вердикта → сколько экспертиз. */
    verdictCounts: Array<{ id: number; name: string; tone: string | null; count: number }>;
  };
  criteriaAverages: SummaryCriterionAverage[];
}

/**
 * Собирает сводку по критерию отбора. Возвращает готовые данные для экрана и для PDF:
 * строки, итоги и средние по критериям.
 */
export async function buildReviewSummary(user: CurrentUser, params: ReviewSelectionParams): Promise<ReviewSummary> {
  requireAdmin(user);

  const reviews = await prisma.application_reviews.findMany({
    where: { deleted_at: null, ...selectionWhere(params) },
    orderBy: { id: 'asc' },
    include: {
      applications: {
        select: {
          id: true,
          title: true,
          tender_id: true,
          tenders: { select: { name: true } },
          directions: { select: { name: true } },
        },
      },
      users: { select: { id: true, name: true, surname: true, patronymic: true, email: true } },
      review_statuses: { select: { id: true, name: true, tone: true } },
    },
  });

  const rows: SummaryReviewRow[] = reviews.map((review) => ({
    id: review.id,
    applicationId: review.application_id,
    applicationTitle: review.applications?.title ?? null,
    tender: review.applications?.tenders?.name ?? null,
    direction: review.applications?.directions?.name ?? null,
    expertId: review.expert_id,
    expertName: review.users ? formatPerson(review.users) : `Эксперт #${review.expert_id}`,
    verdictId: review.review_statuses?.id ?? null,
    verdictName: review.review_statuses?.name ?? null,
    verdictTone: review.review_statuses?.tone ?? null,
    totalScore: review.total_score,
    text: review.review_text,
    rating: normalizeRating(review.rating),
    updatedAt: review.updated_at,
  }));

  return {
    ...describeSelection(params, rows),
    reviews: rows,
    totals: buildTotals(rows),
    criteriaAverages: await buildCriteriaAverages(rows),
  };
}

/** Условие выборки: ровно один критерий (совпадает с params задания PDF). */
function selectionWhere(params: ReviewSelectionParams) {
  if ('all' in params) return {};
  if ('expert_id' in params) return { expert_id: params.expert_id };
  if ('status_id' in params) return { status_id: params.status_id };
  if ('application_id' in params) return { application_id: params.application_id };
  return { id: { in: params.review_ids } };
}

/**
 * Заголовок сводки выводится из состава выборки, а не задаётся вручную:
 * одна заявка → «Заявка», один эксперт → «Эксперт», один вердикт → «Вердикт».
 */
function describeSelection(
  params: ReviewSelectionParams,
  rows: SummaryReviewRow[],
): { kind: ReviewSummary['kind']; title: string; subtitle: string | null } {
  if ('all' in params) {
    return { kind: 'selection', title: 'Все экспертизы', subtitle: null };
  }
  if ('application_id' in params) {
    const title = rows[0]?.applicationTitle;
    return {
      kind: 'application',
      title: title ? `Заявка: ${title}` : `Заявка #${params.application_id}`,
      subtitle: rows[0]?.tender ? `Конкурс: ${rows[0].tender}` : null,
    };
  }
  if ('expert_id' in params) {
    const name = rows[0]?.expertName;
    return { kind: 'expert', title: name ? `Эксперт: ${name}` : `Эксперт #${params.expert_id}`, subtitle: null };
  }
  if ('status_id' in params) {
    const name = rows[0]?.verdictName;
    return { kind: 'verdict', title: name ? `Вердикт: ${name}` : `Вердикт #${params.status_id}`, subtitle: null };
  }

  // Произвольный набор строк: подпись — «Выборка: N экспертиз».
  const suffix = pluralize(rows.length, 'экспертиза', 'экспертизы', 'экспертиз');
  const experts = new Set(rows.map((row) => row.expertId));
  const applications = new Set(rows.map((row) => row.applicationId));
  // Если набор всё равно свёлся к одному эксперту или заявке — подписываем как сводку по нему.
  if (experts.size === 1 && rows.length > 1) return { kind: 'expert', title: `Эксперт: ${rows[0].expertName}`, subtitle: null };
  if (applications.size === 1 && rows.length > 1) {
    const title = rows[0].applicationTitle ? `Заявка: ${rows[0].applicationTitle}` : `Заявка #${rows[0].applicationId}`;
    return { kind: 'application', title, subtitle: null };
  }
  return { kind: 'selection', title: `Выборка: ${rows.length} ${suffix}`, subtitle: null };
}

function buildTotals(rows: SummaryReviewRow[]): ReviewSummary['totals'] {
  const scored = rows.filter((row) => row.totalScore !== null);
  const verdictMap = new Map<number, { id: number; name: string; tone: string | null; count: number }>();
  for (const row of rows) {
    if (row.verdictId === null) continue;
    const existing = verdictMap.get(row.verdictId);
    if (existing) existing.count += 1;
    else verdictMap.set(row.verdictId, { id: row.verdictId, name: row.verdictName ?? '', tone: row.verdictTone, count: 1 });
  }

  return {
    reviews: rows.length,
    applications: new Set(rows.map((row) => row.applicationId)).size,
    experts: new Set(rows.map((row) => row.expertId)).size,
    averageScore: scored.length
      ? Math.round((scored.reduce((sum, row) => sum + (row.totalScore ?? 0), 0) / scored.length) * 100) / 100
      : null,
    verdictCounts: [...verdictMap.values()].sort((a, b) => b.count - a.count),
  };
}

/**
 * Средние по критериям конкурса. Конкурсы у заявок могут отличаться, поэтому
 * критерии собираются по всем затронутым конкурсам и группируются по id критерия.
 */
async function buildCriteriaAverages(rows: SummaryReviewRow[]): Promise<SummaryCriterionAverage[]> {
  const usedCriterionIds = new Set<number>();
  for (const row of rows) {
    for (const key of Object.keys(row.rating)) usedCriterionIds.add(Number(key));
  }
  if (usedCriterionIds.size === 0) return [];

  const criteria = await prisma.evaluation_criteria.findMany({
    where: { id: { in: [...usedCriterionIds] }, deleted_at: null },
    select: { id: true, name: true, weight: true },
    orderBy: { id: 'asc' },
  });

  return criteria.map((criterion) => {
    const values: number[] = [];
    for (const row of rows) {
      const value = row.rating[String(criterion.id)];
      if (typeof value === 'number') values.push(value);
    }
    const average = values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
    return {
      criterionId: criterion.id,
      name: criterion.name,
      weight: criterion.weight,
      averageScore: Math.round(average * 100) / 100,
    };
  });
}

/** Приводит Json-оценку к плоскому объекту «id критерия → число». */
function normalizeRating(raw: unknown): Record<string, number> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const result: Record<string, number> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const score = Number(value);
    if (Number.isFinite(score)) result[key] = score;
  }
  return result;
}

/** Единый формат ФИО (совпадает с `formatUserName` на фронтенде). */
export function formatPerson(person: {
  surname: string | null;
  name: string | null;
  patronymic: string | null;
  email?: string;
}): string {
  const full = [person.surname, person.name, person.patronymic].filter(Boolean).join(' ').trim();
  return full || person.email || '—';
}

function pluralize(count: number, one: string, few: string, many: string): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}
