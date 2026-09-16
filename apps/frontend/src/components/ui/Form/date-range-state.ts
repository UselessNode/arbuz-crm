// Состояние выбора периода дат: чистая логика (покрыта смоук-тестом).
// Даты — строки yyyy-mm-dd, '' означает «не выбрано». Формат выбран так,
// чтобы сравнение периодов работало и лексикографически.

export interface DateRange {
  from: string;
  to: string;
}

export const EMPTY_DATE_RANGE: DateRange = { from: '', to: '' };

export function isDateRangeEmpty(range: DateRange): boolean {
  return !range.from && !range.to;
}

/**
 * Шаг выбора периода одним кликом в календаре:
 *   • выбор завершён (или ещё не начат) — начинаем новый период с этой даты;
 *   • выбрана только начальная дата — она же и завершает период;
 *   • вторая дата раньше первой — начинаем период заново от неё.
 * Возвращает новое значение и признак завершённости (чтобы закрыть календарь).
 */
export function stepDateRange(current: DateRange, date: string): { range: DateRange; complete: boolean } {
  if (!current.from || (current.from && current.to)) {
    return { range: { from: date, to: '' }, complete: false };
  }
  if (date < current.from) return { range: { from: date, to: '' }, complete: false };
  return { range: { from: current.from, to: date }, complete: true };
}

/** Подпись периода для поля: «01.09.2026 — 30.09.2026». */
export function formatDateRange(range: DateRange, format: (iso: string) => string): string {
  if (!range.from) return '';
  if (!range.to) return `с ${format(range.from)}`;
  return `${format(range.from)} — ${format(range.to)}`;
}

/** Убирает из периода части, обратные по порядку (защита от состояния из URL). */
export function normalizeDateRange(range: DateRange): DateRange {
  if (range.from && range.to && range.to < range.from) return { from: range.to, to: range.from };
  return range;
}
