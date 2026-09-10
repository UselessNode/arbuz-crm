import { api } from './client';

export interface Tender {
  id: number;
  name: string;
  description: string | null;
}

export interface Criterion {
  id: number;
  tenderId: number;
  name: string;
  description: string | null;
  minValue: number;
  maxValue: number;
  weight: number;
  config: unknown;
}

export interface Direction {
  id: number;
  name: string;
  description: string | null;
  tenderId: number | null;
}

export interface ApplicationStatus {
  id: number;
  name: string;
  isEditable: boolean | null;
  isDeletable: boolean | null;
  description: string | null;
}

export interface TenderPayload {
  name: string;
  description: string | null;
}

export interface CriterionPayload {
  name: string;
  description?: string | null;
  min_value?: number;
  max_value?: number;
  weight?: number;
}

export interface DirectionPayload {
  name: string;
  description: string | null;
  tender_id: number | null;
}

export interface ApplicationStatusPayload {
  name: string;
  description: string | null;
  is_editable: boolean;
  is_deletable: boolean;
}

export const tendersApi = {
  list: () => api.get<{ tenders: Tender[] }>('/tenders'),
  create: (payload: TenderPayload) => api.post<{ tender: Tender }>('/tenders', payload),
  update: (id: number, payload: TenderPayload) => api.patch<{ tender: Tender }>(`/tenders/${id}`, payload),
  remove: (id: number) => api.delete<{ ok: boolean }>(`/tenders/${id}`),
};

export const criteriaApi = {
  list: (tenderId: number) => api.get<{ criteria: Criterion[] }>(`/tenders/${tenderId}/criteria`),
  create: (tenderId: number, payload: CriterionPayload) =>
    api.post<{ criterion: Criterion }>(`/tenders/${tenderId}/criteria`, payload),
  update: (tenderId: number, id: number, payload: CriterionPayload) =>
    api.patch<{ criterion: Criterion }>(`/tenders/${tenderId}/criteria/${id}`, payload),
  remove: (tenderId: number, id: number) => api.delete<{ ok: boolean }>(`/tenders/${tenderId}/criteria/${id}`),
};

export const directionsApi = {
  list: () => api.get<{ directions: Direction[] }>('/directions'),
  create: (payload: DirectionPayload) => api.post<{ direction: Direction }>('/directions', payload),
  update: (id: number, payload: DirectionPayload) => api.patch<{ direction: Direction }>(`/directions/${id}`, payload),
  remove: (id: number) => api.delete<{ ok: boolean }>(`/directions/${id}`),
};

export const statusesApi = {
  list: () => api.get<{ statuses: ApplicationStatus[] }>('/application-statuses'),
  create: (payload: ApplicationStatusPayload) => api.post<{ status: ApplicationStatus }>('/application-statuses', payload),
  update: (id: number, payload: ApplicationStatusPayload) =>
    api.patch<{ status: ApplicationStatus }>(`/application-statuses/${id}`, payload),
  remove: (id: number) => api.delete<{ ok: boolean }>(`/application-statuses/${id}`),
};
