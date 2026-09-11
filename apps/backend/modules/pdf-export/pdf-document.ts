// Построение PDF-выгрузки заявки: 9 текстовых секций + таблица бюджета.
// ВНИМАНИЕ (технический долг): точный состав/порядок секций должен совпасть
// с модалкой создания/редактирования и предпросмотром заявки во фронтенде
// (Session 3+). Здесь — рабочее ядро «как есть» по текущим полям схемы.
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

export interface ExportTeamMember {
  surname: string;
  name: string;
  patronymic: string | null;
  tasks_in_project: string | null;
}

export interface ExportPlanItem {
  task: string;
  event_name: string;
  start_date: Date | null;
  end_date: Date | null;
}

export interface ExportBudgetItem {
  resource_type: string;
  quantity: number | null;
  unit_cost: number | null;
  own_funds: number | null;
  grant_funds: number | null;
  comment: string | null;
}

export interface ExportMaterial {
  file_name: string;
  file_type: string | null;
  file_bytes_size: number | null;
}

export interface ExportApplicationData {
  id: number;
  title: string;
  tenderName: string | null;
  directionName: string | null;
  statusName: string | null;
  idea_description: string | null;
  importance_to_team: string | null;
  project_goal: string | null;
  project_tasks: string | null;
  implementation_experience: string | null;
  results_description: string | null;
  team: ExportTeamMember[];
  plans: ExportPlanItem[];
  budget: ExportBudgetItem[];
  materials: ExportMaterial[];
}

interface PdfFonts {
  Roboto: {
    normal: Buffer;
    bold: Buffer;
    italics: Buffer;
    bolditalics: Buffer;
  };
}

function loadFonts(): PdfFonts {
  const rawVfs = require('pdfmake/build/vfs_fonts');
  const vfs: Record<string, string> = rawVfs.default ?? rawVfs;
  const font = (name: string): Buffer => Buffer.from(vfs[name] ?? '', 'base64');
  return {
    Roboto: {
      normal: font('Roboto-Regular.ttf'),
      bold: font('Roboto-Medium.ttf'),
      italics: font('Roboto-Italic.ttf'),
      bolditalics: font('Roboto-MediumItalic.ttf'),
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DocNode = any;

function fmtDate(value: Date | null): string {
  if (!value) return '—';
  return `${value.getDate().toString().padStart(2, '0')}.${(value.getMonth() + 1)
    .toString()
    .padStart(2, '0')}.${value.getFullYear()}`;
}

function textOrDash(value: string | null | undefined): string {
  const text = (value ?? '').trim();
  return text.length ? text : '—';
}

function sectionTitle(number: number, title: string): DocNode {
  return {
    text: `${number}. ${title}`,
    style: 'h2',
  };
}

function paragraph(text: string): DocNode {
  return { text, style: 'body' };
}

/** Собирает docDefinition pdfmake из данных заявки. */
export function buildPdfDefinition(data: ExportApplicationData): DocNode {
  const content: DocNode[] = [
    { text: 'Заявка на грант', style: 'title' },
    { text: data.title, style: 'subtitle' },
    {
      columns: [
        { width: '*', text: [`Конкурс: `, { text: textOrDash(data.tenderName), bold: true }], style: 'small' },
        { width: '*', text: [`Направление: `, { text: textOrDash(data.directionName), bold: true }], style: 'small' },
      ],
    },
    { text: `Статус: ${textOrDash(data.statusName)}`, style: 'small', margin: [0, 0, 0, 12] },
  ];

  const sections: Array<[string, string | null | undefined]> = [
    ['Идея проекта', data.idea_description],
    ['Значимость для команды', data.importance_to_team],
    ['Цель проекта', data.project_goal],
    ['Задачи проекта', data.project_tasks],
    ['Опыт команды', data.implementation_experience],
    ['Ожидаемые результаты', data.results_description],
  ];
  sections.forEach(([title, value], index) => {
    content.push(sectionTitle(index + 1, title));
    content.push(paragraph(textOrDash(value)));
  });

  content.push(sectionTitle(7, 'Команда проекта'));
  if (data.team.length === 0) {
    content.push(paragraph('—'));
  } else {
    data.team.forEach((member) => {
      const full = [member.surname, member.name, member.patronymic].filter(Boolean).join(' ');
      content.push({ text: full, style: 'body' });
      if (member.tasks_in_project) {
        content.push({ text: `Задачи в проекте: ${member.tasks_in_project}`, style: 'small', margin: [0, 0, 0, 4] });
      }
    });
  }

  content.push(sectionTitle(8, 'План работы'));
  if (data.plans.length === 0) {
    content.push(paragraph('—'));
  } else {
    data.plans.forEach((plan) => {
      const period = plan.start_date || plan.end_date ? ` (${fmtDate(plan.start_date)} — ${fmtDate(plan.end_date)})` : '';
      content.push({ text: `• ${plan.event_name}${period}`, style: 'body' });
      if (plan.task) content.push({ text: plan.task, style: 'small', margin: [0, 0, 0, 4] });
    });
  }

  content.push(sectionTitle(9, 'Дополнительные материалы'));
  if (data.materials.length === 0) {
    content.push(paragraph('—'));
  } else {
    data.materials.forEach((material) => {
      const size =
        material.file_bytes_size === null || material.file_bytes_size === undefined
          ? ''
          : ` — ${Math.max(1, Math.round(Number(material.file_bytes_size) / 1024))} КБ`;
      content.push({ text: `• ${material.file_name}${size}`, style: 'body' });
    });
  }

  // Таблица бюджета.
  content.push({ text: 'Бюджет проекта', style: 'h2' });
  const money = (value: number | null): string => (value === null ? '—' : value.toLocaleString('ru-RU'));
  const tableBody: DocNode[][] = [
    [
      { text: 'Ресурс', style: 'tableHeader' },
      { text: 'Кол-во', style: 'tableHeader' },
      { text: 'Цена за ед., ₽', style: 'tableHeader' },
      { text: 'Свои средства, ₽', style: 'tableHeader' },
      { text: 'Запрашиваемая сумма, ₽', style: 'tableHeader' },
    ],
  ];
  let ownTotal = 0;
  let grantTotal = 0;
  for (const item of data.budget) {
    ownTotal += item.own_funds ?? 0;
    grantTotal += item.grant_funds ?? 0;
    tableBody.push([
      { text: item.resource_type, style: 'cell' },
      { text: item.quantity === null ? '—' : String(item.quantity), style: 'cell' },
      { text: money(item.unit_cost), style: 'cell' },
      { text: money(item.own_funds), style: 'cell' },
      { text: money(item.grant_funds), style: 'cell' },
    ]);
  }
  tableBody.push([
    { text: 'Итого', style: 'tableFooter' },
    { text: '', style: 'tableFooter' },
    { text: '', style: 'tableFooter' },
    { text: ownTotal.toLocaleString('ru-RU'), style: 'tableFooter' },
    { text: grantTotal.toLocaleString('ru-RU'), style: 'tableFooter' },
  ]);
  content.push({
    style: 'table',
    table: { headerRows: 1, widths: ['*', 'auto', 'auto', 'auto', 'auto'], body: tableBody },
    layout: 'lightHorizontalLines',
  });

  return {
    pageSize: 'A4',
    pageMargins: [40, 40, 40, 40],
    defaultStyle: { font: 'Roboto', fontSize: 10 },
    styles: {
      title: { fontSize: 18, bold: true, margin: [0, 0, 0, 4] },
      subtitle: { fontSize: 14, margin: [0, 0, 0, 8] },
      h2: { fontSize: 12, bold: true, margin: [0, 14, 0, 4] },
      body: { fontSize: 10, margin: [0, 0, 0, 4], lineHeight: 1.3 },
      small: { fontSize: 9, color: '#444444' },
      tableHeader: { bold: true, fontSize: 9, fillColor: '#eeeeee', margin: [2, 2, 2, 2] },
      tableFooter: { bold: true, fontSize: 9, margin: [2, 2, 2, 2] },
      cell: { fontSize: 9, margin: [2, 2, 2, 2] },
    },
    content,
  };
}

/** Рендерит docDefinition в Buffer (pdfmake + встроенные шрифты Roboto). */
export function renderPdfBuffer(docDefinition: DocNode): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const PdfPrinter = require('pdfmake');
      const printer = new PdfPrinter(loadFonts());
      const stream = printer.createPdfKitDocument(docDefinition);
      const chunks: Buffer[] = [];
      stream.on('data', (chunk: Buffer) => chunks.push(Buffer.from(chunk)));
      stream.on('error', reject);
      stream.on('end', () => resolve(Buffer.concat(chunks)));
      stream.end();
    } catch (error) {
      reject(error);
    }
  });
}
