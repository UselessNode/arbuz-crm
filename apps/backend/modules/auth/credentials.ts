// Валидация учётных данных (общая для пользователей и регистрации).
import { httpError } from '../../lib/http';

export const PASSWORD_MIN_LENGTH = 8;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function parseEmail(value: unknown): string {
  const email = String(value ?? '').trim().toLowerCase();
  if (!email || !EMAIL_RE.test(email)) {
    throw httpError(400, 'Некорректный email', 'INVALID_EMAIL');
  }
  return email;
}

export function parsePassword(value: unknown): string {
  const password = String(value ?? '');
  if (password.length < PASSWORD_MIN_LENGTH) {
    throw httpError(400, `Пароль должен быть не короче ${PASSWORD_MIN_LENGTH} символов`, 'PASSWORD_TOO_SHORT');
  }
  return password;
}
