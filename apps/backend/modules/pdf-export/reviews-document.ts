// Построение PDF-отчёта по набору экспертиз (сводка).
// Данные приходят из `modules/reviews/summary.service` — воркер не собирает их сам,
// иначе сводка на экране и в документе разойдутся.
import type { ReviewSummary, SummaryReviewRow } from '../reviews/summary.service';

// pdfmake не поставляет типов; обход типизации — единственный `any` в модуле.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DocNode = any;

function fmtDate(value: Date): string {
  return `${value.getDate().toString().padStart(2, '0')}.${(value.getMonth() + 1)
    .toString()
    .padStart(2, '0')}.${value.getFullYear()}`;
}

function textOrDash(value: string | null | undefined): string {
  const text = (value ?? '').trim();
  return text.length ? text : '—';
}

function scoreOrDash(value: number | null): string {
  return value === null ? '—' : value.toLocaleString('ru-RU');
}

/** Собирает docDefinition pdfmake для сводки по экспертизам. */
export function buildReviewsPdfDefinition(summary: ReviewSummary): DocNode {
  const content: DocNode[] = [
    { text: 'Сводка по экспертизам', style: 'title' },
    { text: summary.title, style: 'subtitle' },
  ];
  if (summary.subtitle) content.push({ text: summary.subtitle, style: 'small' });
  content.push({
    text: `Сформировано: ${fmtDate(new Date())}`,
    style: 'small',
    margin: [0, 0, 0, 10],
  });

  // --- Итоги ---
  content.push({ text: '1. Итоги', style: 'h2' });
  content.push({
    columns: [
      { width: '*', text: [`Экспертиз: `, { text: String(summary.totals.reviews), bold: true }], style: 'small' },
      { width: '*', text: [`Заявок: `, { text: String(summary.totals.applications), bold: true }], style: 'small' },
      { width: '*', text: [`Экспертов: `, { text: String(summary.totals.experts), bold: true }], style: 'small' },
      {
        width: '*',
        text: [`Средний балл: `, { text: scoreOrDash(summary.totals.averageScore), bold: true }],
        style: 'small',
      },
    ],
    margin: [0, 0, 0, 6],
  });

  if (summary.totals.verdictCounts.length > 0) {
    content.push({ text: 'Распределение по вердиктам', style: 'h3' });
    const verdictBody: DocNode[][] = [
      [
        { text: 'Вердикт', style: 'tableHeader' },
        { text: 'Экспертиз', style: 'tableHeader' },
      ],
    ];
    for (const verdict of summary.totals.verdictCounts) {
      verdictBody.push([
        { text: verdict.name || '—', style: 'cell' },
        { text: String(verdict.count), style: 'cell' },
      ]);
    }
    content.push({
      style: 'table',
      table: { headerRows: 1, widths: ['*', 'auto'], body: verdictBody },
      layout: 'lightHorizontalLines',
      margin: [0, 0, 0, 6],
    });
  }

  // --- Средние по критериям ---
  if (summary.criteriaAverages.length > 0) {
    content.push({ text: 'Средние по критериям оценивания', style: 'h3' });
    const criteriaBody: DocNode[][] = [
      [
        { text: 'Критерий', style: 'tableHeader' },
        { text: 'Вес', style: 'tableHeader' },
        { text: 'Средний балл', style: 'tableHeader' },
      ],
    ];
    for (const criterion of summary.criteriaAverages) {
      criteriaBody.push([
        { text: criterion.name, style: 'cell' },
        { text: String(criterion.weight), style: 'cell' },
        { text: scoreOrDash(criterion.averageScore), style: 'cell' },
      ]);
    }
    content.push({
      style: 'table',
      table: { headerRows: 1, widths: ['*', 'auto', 'auto'], body: criteriaBody },
      layout: 'lightHorizontalLines',
      margin: [0, 0, 0, 6],
    });
  }

  // --- Экспертизы ---
  content.push({ text: '2. Экспертизы', style: 'h2' });
  if (summary.reviews.length === 0) {
    content.push({ text: 'Ни одна экспертиза не подошла под условия отбора.', style: 'body' });
  } else {
    // Названия критериев для оценок внутри экспертиз: в строках хранятся только id.
    const criterionNames = new Map(summary.criteriaAverages.map((item) => [String(item.criterionId), item.name]));
    summary.reviews.forEach((review, index) => {
      content.push(reviewBlock(review, index + 1, criterionNames));
    });
  }

  return {
    pageSize: 'A4',
    pageMargins: [40, 40, 40, 40],
    defaultStyle: { font: 'Roboto', fontSize: 10 },
    styles: {
      title: { fontSize: 18, bold: true, margin: [0, 0, 0, 4] },
      subtitle: { fontSize: 14, margin: [0, 0, 0, 4] },
      h2: { fontSize: 12, bold: true, margin: [0, 14, 0, 4] },
      h3: { fontSize: 10, bold: true, margin: [0, 8, 0, 4] },
      body: { fontSize: 10, margin: [0, 0, 0, 4], lineHeight: 1.3 },
      small: { fontSize: 9, color: '#444444' },
      tableHeader: { bold: true, fontSize: 9, fillColor: '#eeeeee', margin: [2, 2, 2, 2] },
      cell: { fontSize: 9, margin: [2, 2, 2, 2] },
    },
    content,
  };
}

/** Блок одной экспертизы: заявка, эксперт, вердикт, балл, оценки и комментарий. */
function reviewBlock(review: SummaryReviewRow, number: number, criterionNames: Map<string, string>): DocNode {
  const heading = `${number}. ${textOrDash(review.applicationTitle)} — ${review.expertName}`;
  const stack: DocNode[] = [
    { text: heading, style: 'h3' },
    {
      columns: [
        { width: '*', text: `Конкурс: ${textOrDash(review.tender)}`, style: 'small' },
        { width: '*', text: `Направление: ${textOrDash(review.direction)}`, style: 'small' },
      ],
    },
    {
      columns: [
        { width: '*', text: `Вердикт: ${textOrDash(review.verdictName)}`, style: 'small' },
        { width: '*', text: `Итоговый балл: ${scoreOrDash(review.totalScore)}`, style: 'small' },
        { width: '*', text: `Обновлена: ${fmtDate(review.updatedAt)}`, style: 'small' },
      ],
      margin: [0, 2, 0, 4],
    },
  ];

  // Оценки по критериям — с названиями (в рейтинге хранятся только id критериев).
  const ratings = Object.entries(review.rating);
  if (ratings.length > 0) {
    stack.push({
      text: ratings
        .map(([id, value]) => `${criterionNames.get(id) ?? `Критерий ${id}`}: ${value.toLocaleString('ru-RU')}`)
        .join('   '),
      style: 'small',
    });
  }

  stack.push({ text: textOrDash(review.text), style: 'body', margin: [0, 6, 0, 10] });
  return { stack };
}
