import { api } from './client';

export interface Post {
  id: number;
  title: string;
  content: string;
  contentHtml: string;
  is_published: boolean;
  createdBy: number | null;
  authorName: string | null;
  createdAt: string;
  updatedAt: string;
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
}

export const postsApi = {
  list: (params?: { limit?: number; offset?: number }) => {
    const query = new URLSearchParams();
    if (params?.limit !== undefined) query.set('limit', String(params.limit));
    if (params?.offset !== undefined) query.set('offset', String(params.offset));
    const suffix = query.toString() ? `?${query.toString()}` : '';
    return api.get<{ posts: Post[]; total: number }>(`/posts${suffix}`);
  },
  get: (id: number) => api.get<{ post: Post }>(`/posts/${id}`),
  create: (payload: PostPayload) => api.post<{ post: Post }>('/posts', payload),
  update: (id: number, payload: PostPayload) => api.patch<{ post: Post }>(`/posts/${id}`, payload),
  remove: (id: number) => api.delete<{ ok: boolean }>(`/posts/${id}`),
  files: {
    list: (postId: number) => api.get<{ files: PostFile[] }>(`/posts/${postId}/files`),
    upload: (postId: number, file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      return api.upload<{ file: PostFile }>(`/posts/${postId}/files`, formData);
    },
    remove: (postId: number, fileId: number) => api.delete<{ ok: boolean }>(`/posts/${postId}/files/${fileId}`),
  },
};
