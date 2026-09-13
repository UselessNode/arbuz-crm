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

export const reviewsApi = {
  list: () => api.get<{ reviews: ReviewListItem[] }>('/reviews'),
  assign: (applicationId: number, expertId: number) =>
    api.post<{ review: ReviewListItem }>(`/applications/${applicationId}/reviews`, { expert_id: expertId }),
  update: (reviewId: number, patch: { status_id?: number; review_text?: string | null; rating?: unknown }) =>
    api.patch<{ review: ReviewListItem }>(`/reviews/${reviewId}`, patch),
  remove: (reviewId: number) => api.delete<{ ok: boolean }>(`/reviews/${reviewId}`),
};
