// API сводки по экспертизам (только admin): данные для режима с группировкой,
// страницы сводки и PDF-отчёта.
import { api } from './client';

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
  rating: Record<string, number>;
  updatedAt: string;
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
    verdictCounts: Array<{ id: number; name: string; tone: string | null; count: number }>;
  };
  criteriaAverages: Array<{ criterionId: number; name: string; averageScore: number; weight: number }>;
}

export interface ReviewSelectionAll {
  /** Без критерия — все экспертизы (сводка по всей базе). */
  all?: true;
  review_ids?: undefined;
  expert_id?: undefined;
  status_id?: undefined;
  application_id?: undefined;
}

/** Критерий отбора: только id (подпись отчёта формируется отдельно). */
export type ReviewSelection =
  | { review_ids: number[] }
  | { expert_id: number }
  | { status_id: number }
  | { application_id: number }
  | { all: true };

function selectionQuery(selection: ReviewSelection): string {
  if ('all' in selection) return 'all=1';
  if ('review_ids' in selection) return `review_ids=${selection.review_ids.join(',')}`;
  if ('expert_id' in selection) return `expert_id=${selection.expert_id}`;
  if ('status_id' in selection) return `status_id=${selection.status_id}`;
  return `application_id=${selection.application_id}`;
}

export const reviewsSummaryApi = {
  get: (selection: ReviewSelection) =>
    api.get<{ summary: ReviewSummary }>(`/reviews/summary?${selectionQuery(selection)}`),
};

/** Подпись отчёта для тоста и списка. */
export function summaryLabel(summary: ReviewSummary): string {
  return `${summary.title} — отчёт готов`;
}
