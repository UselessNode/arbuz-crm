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
  list: () => api.get<{ posts: Post[] }>('/posts'),
  get: (id: number) => api.get<{ post: Post }>(`/posts/${id}`),
  create: (payload: PostPayload) => api.post<{ post: Post }>('/posts', payload),
  update: (id: number, payload: PostPayload) => api.patch<{ post: Post }>(`/posts/${id}`, payload),
  remove: (id: number) => api.delete<{ ok: boolean }>(`/posts/${id}`),
  preview: (content: string) => api.post<{ html: string }>('/posts/preview', { content }),
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
