// API массового удаления сущностей (admin, с подтверждением пароля).
import { api } from './client';

export type BulkEntity = 'reviews' | 'applications' | 'users' | 'posts';

export interface BulkDeleteResult {
  entity: BulkEntity;
  deleted: number;
}

export const bulkDeleteApi = {
  remove: (entity: BulkEntity, ids: number[], password: string) =>
    api.post<BulkDeleteResult>('/bulk-delete', { entity, ids, password }),
};
