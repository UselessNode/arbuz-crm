// Помощники календаря: разбор дат, сетка месяца, навигация по месяцам и годам.
// Чистая логика без React и CSS — покрыта смоук-тестом
// (по образцу `accordion-state.ts` / `carousel-state.ts` / `range-state.ts`).

export const CALENDAR_MONTHS = [
  'январь',
  'февраль',
  'март',
  'апрель',
  'май',
  'июнь',
  'июль',
  'август',
  'сентябрь',
  'октябрь',
  'ноябрь',
  'декабрь',
];

/** Неделя начинается с понедельника (как принято в русскоязычном интерфейсе). */
export const CALENDAR_WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

/** Сколько лет показываем в сетке выбора года (десятилетие). */
export const CALENDAR_DECADE = 10;

/** yyyy-mm-dd → Date (локальная полночь) либо null. */
export function parseISODate(value: string | undefined | null): Date | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

/** Date → yyyy-mm-dd. */
export function toISODate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

export function formatDisplayDate(date: Date): string {
  return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function isSameDay(left: Date, right: Date): boolean {
  return (
    left.getFullYear() === right.getFullYear() && left.getMonth() === right.getMonth() && left.getDate() === right.getDate()
  );
}

/** Начало месяца — состояние «отображаемый месяц». */
export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

/** Сдвиг на N месяцев с переходом через год. */
export function shiftMonth(viewMonth: Date, delta: number): Date {
  return new Date(viewMonth.getFullYear(), viewMonth.getMonth() + delta, 1);
}

/** Ячейки месяца: пустые места до первого дня и сами дни. */
export function monthCells(viewMonth: Date): Array<Date | null> {
  const first = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1);
  const leading = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 0).getDate();
  const cells: Array<Date | null> = [];
  for (let i = 0; i < leading; i += 1) cells.push(null);
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push(new Date(viewMonth.getFullYear(), viewMonth.getMonth(), day));
  }
  return cells;
}

/** Подпись месяца в заголовке («сентябрь 2026»). */
export function monthTitle(viewMonth: Date): string {
  return `${CALENDAR_MONTHS[viewMonth.getMonth()]} ${viewMonth.getFullYear()}`;
}

/** Первый год десятилетия, в которое попадает дата. */
export function decadeStart(viewMonth: Date): number {
  return Math.floor(viewMonth.getFullYear() / CALENDAR_DECADE) * CALENDAR_DECADE;
}

/** Годы десятилетия — сетка быстрого выбора года. */
export function decadeYears(viewMonth: Date): number[] {
  const start = decadeStart(viewMonth);
  return Array.from({ length: CALENDAR_DECADE }, (_, index) => start + index);
}
