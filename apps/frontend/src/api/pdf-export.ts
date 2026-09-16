// API асинхронной выгрузки PDF: отчёт по заявке и отчёт по набору экспертиз.
import type { PdfExportStatus, PdfReportKind } from '@arbuz/shared';
import { api } from './client';

/** Значения статуса задания (совпадают с PdfExportStatus на бэкенде). */
export const PdfExportStatuses = {
  pending: 'pending',
  processing: 'processing',
  done: 'done',
  error: 'error',
} as const satisfies Record<PdfExportStatus, PdfExportStatus>;

/** Типы отчётов (совпадают с enum PdfReportKind на бэкенде). */
export const PdfReportKinds = {
  application: 'application',
  reviews: 'reviews',
} as const satisfies Record<PdfReportKind, PdfReportKind>;

/** Предельное время ожидания отчёта (совпадает с watchdog воркера на бэкенде). */
export const PDF_POLL_INTERVAL_MS = 1500;
export const PDF_MAX_ATTEMPTS = 200;

export interface PdfExportJob {
  id: number;
  kind: PdfReportKind;
  applicationId: number | null;
  label: string | null;
  status: PdfExportStatus;
  fileId: number | null;
  error: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Критерий отбора экспертиз для сводки (совпадает с params задания на бэкенде). */
export type ReviewExportSelection =
  | { expert_id: number; label?: string | null }
  | { status_id: number; label?: string | null }
  | { application_id: number; label?: string | null }
  | { review_ids: number[]; label?: string | null }
  /** Без критерия — все экспертизы (сводка по всей базе). */
  | { all: true; label?: string | null };

export const pdfExportApi = {
  start: (applicationId: number) => api.post<{ job: PdfExportJob }>(`/applications/${applicationId}/pdf-export`),
  startReviews: (selection: ReviewExportSelection) =>
    api.post<{ job: PdfExportJob }>('/reviews/pdf-export', selection),
  getJob: (jobId: number) => api.get<{ job: PdfExportJob }>(`/pdf-export-jobs/${jobId}`),
  downloadUrl: (jobId: number) => `/api/pdf-export-jobs/${jobId}/download`,
};
