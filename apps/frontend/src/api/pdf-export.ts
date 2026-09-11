// API асинхронной выгрузки заявки в PDF.
import type { PdfExportStatus } from '@arbuz/shared';
import { api } from './client';

/** Значения статуса задания (совпадают с PdfExportStatus на бэкенде). */
export const PdfExportStatuses = {
  pending: 'pending',
  processing: 'processing',
  done: 'done',
  error: 'error',
} as const satisfies Record<PdfExportStatus, PdfExportStatus>;

export interface PdfExportJob {
  id: number;
  applicationId: number;
  status: PdfExportStatus;
  fileId: number | null;
  error: string | null;
  createdAt: string;
  updatedAt: string;
}

export const pdfExportApi = {
  start: (applicationId: number) => api.post<{ job: PdfExportJob }>(`/applications/${applicationId}/pdf-export`),
  getJob: (jobId: number) => api.get<{ job: PdfExportJob }>(`/pdf-export-jobs/${jobId}`),
  downloadUrl: (jobId: number) => `/api/pdf-export-jobs/${jobId}/download`,
};
