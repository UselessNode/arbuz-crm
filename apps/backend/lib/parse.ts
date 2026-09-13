// Общие примитивы разбора входных данных (тело запроса, параметры пути).
import { httpError } from './http';

/** Положительный целочисленный идентификатор (иначе 400). */
export function parseId(raw: unknown, message = 'Некорректный идентификатор'): number {
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) throw httpError(400, message, 'INVALID_ID');
  return value;
}

/** Обязательный текст с обрезкой по длине колонки. */
export function requiredText(value: unknown, field = 'Значение', maxLength = 255): string {
  const text = String(value ?? '').trim();
  if (!text) throw httpError(400, `${field} обязательно`, 'INVALID_BODY');
  return text.slice(0, maxLength);
}

/** Необязательный текст: пустая строка и null приводятся к null. */
export function optionalText(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text.length ? text : null;
}

/** Необязательный флаг; при `fallback` пустое значение даёт fallback, иначе null. */
export function optionalBool(value: unknown, fallback?: boolean): boolean | null {
  if (value === undefined || value === null) return fallback ?? null;
  return Boolean(value);
}

/** Значение из фиксированного набора (иначе 400). */
export function oneOf<T extends string>(value: unknown, allowed: readonly T[], field: string): T {
  if (typeof value === 'string' && (allowed as readonly string[]).includes(value)) return value as T;
  throw httpError(400, `Недопустимое значение поля «${field}». Допустимо: ${allowed.join(', ')}`, 'INVALID_VALUE');
}

/** Значение из фиксированного набора; пустое значение → undefined. */
export function optionalOneOf<T extends string>(value: unknown, allowed: readonly T[], field: string): T | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  return oneOf(value, allowed, field);
}
