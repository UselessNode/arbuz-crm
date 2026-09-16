/*
 * Типы PDF-отчётов (модуль pdf-export).
 *
 * Значения совпадают с enum `PdfReportKind` из схемы БД (Prisma). Здесь они
 * продублированы как обычные строки, потому что во фронтенде из `@arbuz/shared`
 * разрешены только `import type`, а рантайм-значения зеркалятся локально
 * (`apps/frontend/src/api/pdf-export.ts`).
 */

/** Что выгружается в PDF. */
export const PdfReportKinds = {
  /** Отчёт по одной заявке (9 секций: состав, план, бюджет, материалы). */
  application: 'application',
  /** Отчёт по набору экспертиз (сводка: эксперт / вердикт / произвольная выборка). */
  reviews: 'reviews',
} as const;

export type PdfReportKinds = (typeof PdfReportKinds)[keyof typeof PdfReportKinds];

export const PDF_REPORT_KINDS = [PdfReportKinds.application, PdfReportKinds.reviews] as const;

/** Проверка значения из query/API: сужает строку до PdfReportKinds. */
export function isPdfReportKind(value: string): value is PdfReportKinds {
  return (PDF_REPORT_KINDS as readonly string[]).includes(value);
}
