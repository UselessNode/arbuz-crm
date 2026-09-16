// Маска ввода даты (дд.мм.гггг): чистая логика — покрыта смоук-тестом.
// Поля ввода даты и календарь работают с одним значением, поэтому перевод
// между маской и ISO-строкой живёт в одном месте.

/** Цифры ввода → строка маски (точки подставляются сами). */
export function applyDateMask(input: string): string {
  const digits = input.replace(/\D/g, '').slice(0, 8);
  const day = digits.slice(0, 2);
  const month = digits.slice(2, 4);
  const year = digits.slice(4, 8);
  return [day, month, year].filter((part) => part.length > 0).join('.');
}

/** Маска заполнена целиком (10 символов: дд.мм.гггг). */
export function isCompleteMaskedDate(masked: string): boolean {
  return /^\d{2}\.\d{2}\.\d{4}$/.test(masked);
}

/**
 * Реальная ли дата: отсекает 31.02, 00.13 и подобное.
 * Проверяем через Date и сверяем компоненты обратно — иначе JS «переносит»
 * лишний день в следующий месяц.
 */
export function isRealMaskedDate(masked: string): boolean {
  const match = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(masked);
  if (!match) return false;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  if (month < 1 || month > 12 || day < 1) return false;
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

/** Маска → yyyy-mm-dd; неполная или несуществующая дата даёт ''. */
export function maskedToIso(masked: string): string {
  if (!isRealMaskedDate(masked)) return '';
  const [day, month, year] = masked.split('.');
  return `${year}-${month}-${day}`;
}

/** yyyy-mm-dd → маска дд.мм.гггг; некорректное значение даёт ''. */
export function isoToMasked(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso ?? '');
  if (!match) return '';
  return `${match[3]}.${match[2]}.${match[1]}`;
}
