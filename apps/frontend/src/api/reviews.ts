import { api } from './client';
import type { UserBrief } from './types';
import type { ReviewVerdictRef } from './references';

export interface ReviewListItem {
  id: number;
  applicationId: number;
  applicationTitle: string | null;
  expert: UserBrief | null;
  status: ReviewVerdictRef | null;
  text: string | null;
  rating: unknown;
  totalScore: number | null;
  updatedAt: string;
}

export interface ReviewListParams {
  /** Поиск по заявке и эксперту. */
  search?: string;
  /** Мультивыбор вердиктов (review_statuses). */
  statusIds?: number[];
  /** Мультивыбор экспертов. */
  expertIds?: number[];
  /** Мультивыбор заявок. */
  applicationIds?: number[];
  /** Диапазон итогового балла. */
  scoreMin?: number;
  scoreMax?: number;
  createdFrom?: string;
  createdTo?: string;
  updatedFrom?: string;
  updatedTo?: string;
  sort?: string;
  order?: 'asc' | 'desc';
}

export const reviewsApi = {
  list: (params?: ReviewListParams) => {
    const query = new URLSearchParams();
    if (params?.search) query.set('q', params.search);
    if (params?.statusIds?.length) query.set('status_ids', params.statusIds.join(','));
    if (params?.expertIds?.length) query.set('expert_ids', params.expertIds.join(','));
    if (params?.applicationIds?.length) query.set('application_ids', params.applicationIds.join(','));
    if (params?.scoreMin !== undefined) query.set('score_min', String(params.scoreMin));
    if (params?.scoreMax !== undefined) query.set('score_max', String(params.scoreMax));
    if (params?.createdFrom) query.set('created_from', params.createdFrom);
    if (params?.createdTo) query.set('created_to', params.createdTo);
    if (params?.updatedFrom) query.set('updated_from', params.updatedFrom);
    if (params?.updatedTo) query.set('updated_to', params.updatedTo);
    if (params?.sort) query.set('sort', params.sort);
    if (params?.order) query.set('order', params.order);
    const suffix = query.toString() ? `?${query.toString()}` : '';
    return api.get<{ reviews: ReviewListItem[]; total: number }>(`/reviews${suffix}`);
  },
  assign: (applicationId: number, expertId: number) =>
    api.post<{ review: ReviewListItem }>(`/applications/${applicationId}/reviews`, { expert_id: expertId }),
  update: (reviewId: number, patch: { status_id?: number; review_text?: string | null; rating?: unknown }) =>
    api.patch<{ review: ReviewListItem }>(`/reviews/${reviewId}`, patch),
  remove: (reviewId: number) => api.delete<{ ok: boolean }>(`/reviews/${reviewId}`),
};
