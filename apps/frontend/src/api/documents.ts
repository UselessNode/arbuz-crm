// API публичных документов: список для домашней страницы, управление для админки.
import { api } from './client';

export interface PublicDocument {
  id: number;
  title: string;
  description: string | null;
  fileName: string;
  fileType: string | null;
  sortOrder: number;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentPayload {
  title?: string;
  description?: string | null;
  sort_order?: number;
  is_published?: boolean;
}

export const documentsApi = {
  /** Публичный список (только опубликованные). */
  feed: () => api.get<{ documents: PublicDocument[] }>('/documents/feed'),
  /** Полный список для админки. */
  list: () => api.get<{ documents: PublicDocument[] }>('/documents'),
  create: (formData: FormData) => api.upload<{ document: PublicDocument }>('/documents', formData),
  update: (id: number, payload: DocumentPayload) =>
    api.patch<{ document: PublicDocument }>(`/documents/${id}`, payload),
  remove: (id: number) => api.delete<{ ok: boolean }>(`/documents/${id}`),
  downloadUrl: (id: number) => `/api/documents/${id}/download`,
};
