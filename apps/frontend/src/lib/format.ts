// Форматирование для интерфейса.
export function formatUserName(user: { surname?: string | null; name?: string | null; patronymic?: string | null }): string {
  const parts = [user.surname, user.name, user.patronymic].filter((part): part is string => Boolean(part));
  return parts.length ? parts.join(' ') : '—';
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Дата без времени (для полей-дат и календарей). */
export function formatDate(value: string | null | undefined): string {
  const date = parseDateOnly(value);
  if (!date) return '—';
  return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/** Значение из БД (ISO) → `yyyy-mm-dd` для поля даты. */
export function toDateInputValue(value: string | null | undefined): string {
  if (!value) return '';
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : '';
}

/** Дата без времени: часть YYYY-MM-DD трактуется как календарная (без сдвига по часовому поясу). */
function parseDateOnly(value: string | null | undefined): Date | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (match) return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}
