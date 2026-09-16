// Состояние диапазона числовых значений (ползунок с двумя границами).
// Чистая логика — покрыта смоук-тестом (по образцу `accordion-state.ts` / `carousel-state.ts`).

/** Диапазон числовых значений (ползунок с двумя границами). */
export interface NumericRange {
  from: number;
  to: number;
}

/** Прижимает значение к границам и кратности шага. */
export function clampToStep(value: number, min: number, max: number, step: number): number {
  if (!Number.isFinite(value)) return min;
  const clamped = Math.min(Math.max(value, min), max);
  if (step <= 0) return clamped;
  const snapped = min + Math.round((clamped - min) / step) * step;
  // Округляем до точности шага, иначе накапливается 0.30000000000000004.
  const decimals = (String(step).split('.')[1] ?? '').length;
  return Number(Math.min(Math.max(snapped, min), max).toFixed(decimals));
}

/**
 * Двигает одну границу диапазона, не давая ей перескочить через другую:
 * границы не меняются местами «на лету» — так поведение предсказуемо.
 */
export function moveRangeHandle(
  range: NumericRange,
  handle: 'from' | 'to',
  value: number,
  bounds: { min: number; max: number; step: number },
): NumericRange {
  const next = clampToStep(value, bounds.min, bounds.max, bounds.step);
  if (handle === 'from') return { from: Math.min(next, range.to), to: range.to };
  return { from: range.from, to: Math.max(next, range.from) };
}

/** Доля значения на шкале в процентах (для заливки трека). */
export function rangePercent(value: number, min: number, max: number): number {
  if (max <= min) return 0;
  return Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100));
}
