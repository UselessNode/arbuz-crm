import { api } from './client';

export interface ReviewListItem {
  id: number;
  applicationId: number;
  applicationTitle: string | null;
  expert: { id: number; email: string; name: string | null; surname: string | null; patronymic: string | null } | null;
  status: string | null;
  text: string | null;
  rating: unknown;
  totalScore: number | null;
  updatedAt: string;
}

export const reviewsApi = {
  list: () => api.get<{ reviews: ReviewListItem[] }>('/reviews'),
  assign: (applicationId: number, expertId: number) =>
    api.post<{ review: ReviewListItem }>(`/applications/${applicationId}/reviews`, { expert_id: expertId }),
  update: (reviewId: number, patch: { review_status?: string; review_text?: string | null; rating?: unknown }) =>
    api.patch<{ review: ReviewListItem }>(`/reviews/${reviewId}`, patch),
  remove: (reviewId: number) => api.delete<{ ok: boolean }>(`/reviews/${reviewId}`),
};
