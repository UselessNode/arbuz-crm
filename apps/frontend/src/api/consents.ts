// API пользовательских соглашений: текущие редакции документов и образцы ПДн.
import { api } from './client';

/**
 * Типы документов согласий — зеркало enum `ConsentDocumentType` из `@arbuz/shared`.
 * Локальная копия: рантайм-импорт из shared тянет Prisma-клиент в бандл (см. AGENTS.md).
 */
export const ConsentDocumentType = {
  terms: 'terms',
  personal_data_consent: 'personal_data_consent',
} as const;

export type ConsentDocumentType = (typeof ConsentDocumentType)[keyof typeof ConsentDocumentType];

/** Виды образцов согласий ПДн. */
export type ConsentTemplateKind = 'minor' | 'adult';

export interface ConsentDocument {
  id: number;
  type: ConsentDocumentType;
  version: string;
  hash: string;
  text: string;
  /** Безопасный HTML (рендер и санитизация на сервере). */
  html: string;
  publishedAt: string;
  createdBy: number | null;
  createdAt: string;
}

export const consentsApi = {
  current: (type: ConsentDocumentType) =>
    api.get<{ document: ConsentDocument }>(`/consents/documents/current?type=${type}`),
  /** История редакций (только администратор). */
  list: (type?: ConsentDocumentType) =>
    api.get<{ documents: ConsentDocument[] }>(`/consents/documents${type ? `?type=${type}` : ''}`),
  /** Публикация новой редакции (только администратор). */
  publish: (payload: { document_type: ConsentDocumentType; version?: string; text: string }) =>
    api.post<{ document: ConsentDocument }>('/consents/documents', payload),
  templates: {
    /** Ссылка на скачивание образца (docx в приоритете, иначе pdf — решает сервер). */
    downloadUrl: (kind: ConsentTemplateKind) => `/api/consents/templates/${kind}/download`,
  },
};
