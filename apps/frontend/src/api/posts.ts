import type { PostStatus } from '@arbuz/shared';
import { api } from './client';

export interface PostAttachment {
  id: number;
  name: string;
  fileType: string | null;
}

export interface Post {
  id: number;
  title: string;
  content: string;
  contentHtml: string;
  /** Вычисляемый статус: draft | scheduled | published | archived. */
  status: PostStatus;
  /** Автор скрыт в ленте (публикация от лица организации). */
  hideAuthor: boolean;
  /** Дата отложенной публикации (null — не запланирована). */
  scheduledAt: string | null;
  /** Дата архивации (null — не в архиве). */
  archivedAt: string | null;
  /** Когда менялось содержимое — для пометки «Отредактировано». */
  editedAt: string | null;
  createdBy: number | null;
  /** Имя автора; `null`, если автор скрыт. */
  authorName: string | null;
  createdAt: string;
  updatedAt: string;
  /** Вложения поста (приходят вместе со списком — нужны ленте на главной). */
  attachments: PostAttachment[];
}

export interface PostFile {
  id: number;
  name: string;
  fileType: string | null;
  createdAt: string;
}

export interface PostPayload {
  title: string;
  content: string;
  is_published: boolean;
  hide_author: boolean;
  /** ISO-дата отложенной публикации; null — публикация не отложена. */
  scheduled_at: string | null;
  /** Поместить в архив (true) или вернуть из архива (false). */
  archived: boolean;
}

export interface PostListParams {
  limit?: number;
  offset?: number;
  /** Поиск по заголовку (раздел «Публикации»). */
  search?: string;
  /** Фильтр по вычисляемому статусу (раздел «Публикации»). */
  status?: PostStatus;
}

export const postsApi = {
  /** Публичная лента: только опубликованные публикации. */
  feed: (params?: { limit?: number; offset?: number }) => {
    const query = new URLSearchParams();
    if (params?.limit !== undefined) query.set('limit', String(params.limit));
    if (params?.offset !== undefined) query.set('offset', String(params.offset));
    const suffix = query.toString() ? `?${query.toString()}` : '';
    return api.get<{ posts: Post[]; total: number }>(`/posts/feed${suffix}`);
  },
  /** Список раздела «Публикации» (админ): все статусы. */
  list: (params?: PostListParams) => {
    const query = new URLSearchParams();
    if (params?.limit !== undefined) query.set('limit', String(params.limit));
    if (params?.offset !== undefined) query.set('offset', String(params.offset));
    if (params?.search) query.set('q', params.search);
    if (params?.status) query.set('status', params.status);
    const suffix = query.toString() ? `?${query.toString()}` : '';
    return api.get<{ posts: Post[]; total: number }>(`/posts${suffix}`);
  },
  get: (id: number) => api.get<{ post: Post }>(`/posts/${id}`),
  create: (payload: PostPayload) => api.post<{ post: Post }>('/posts', payload),
  update: (id: number, payload: PostPayload) => api.patch<{ post: Post }>(`/posts/${id}`, payload),
  remove: (id: number) => api.delete<{ ok: boolean }>(`/posts/${id}`),
  files: {
    list: (postId: number) => api.get<{ files: PostFile[] }>(`/posts/${postId}/files`),
    downloadUrl: (postId: number, fileId: number) => `/api/posts/${postId}/files/${fileId}/download`,
    upload: (postId: number, file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      return api.upload<{ file: PostFile }>(`/posts/${postId}/files`, formData);
    },
    remove: (postId: number, fileId: number) => api.delete<{ ok: boolean }>(`/posts/${postId}/files/${fileId}`),
  },
};
