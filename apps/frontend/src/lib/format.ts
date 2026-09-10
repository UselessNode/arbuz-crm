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
