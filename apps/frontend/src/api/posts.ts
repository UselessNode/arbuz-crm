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
  is_published: boolean;
  /** Автор скрыт в ленте (публикация от лица организации). */
  hideAuthor: boolean;
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
}

export interface PostListParams {
  limit?: number;
  offset?: number;
  /** Поиск по заголовку (админ). */
  search?: string;
  /** Фильтр по статусу публикации (админ). */
  isPublished?: boolean;
}

export const postsApi = {
  list: (params?: PostListParams) => {
    const query = new URLSearchParams();
    if (params?.limit !== undefined) query.set('limit', String(params.limit));
    if (params?.offset !== undefined) query.set('offset', String(params.offset));
    if (params?.search) query.set('q', params.search);
    if (params?.isPublished !== undefined) query.set('is_published', String(params.isPublished));
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
