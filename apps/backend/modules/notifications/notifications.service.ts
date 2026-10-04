// Бизнес-логика долгих уведомлений (центр уведомлений).
//
// Уведомление адресовано конкретному пользователю (broadcast — fan-out по строкам).
// Другие модули создают уведомления через `createNotification`/`notifyUsers`/`notifyRole`/
// `notifyAll`. Периодические (например, «аккаунт не активирован») идемпотентны по `dedupe_key`.
import { NotificationType, RoleType } from '@arbuz/shared';
import { prisma } from '../../lib/prisma';
import { httpError } from '../../lib/http';
import { optionalText, parseId, requiredText } from '../../lib/parse';
import { renderMarkdown } from '../posts/markdown';
import type { CurrentUser } from '../files/files.service';

export interface NotificationData {
  id: number;
  type: NotificationType;
  title: string;
  body: string | null;
  bodyHtml: string | null;
  link: string | null;
  isRead: boolean;
  createdAt: Date;
  readAt: Date | null;
}

const notificationSelect = {
  id: true,
  type: true,
  title: true,
  body: true,
  link: true,
  is_read: true,
  created_at: true,
  read_at: true,
} as const;

interface NotificationRow {
  id: number;
  type: NotificationType;
  title: string;
  body: string | null;
  link: string | null;
  is_read: boolean;
  created_at: Date;
  read_at: Date | null;
}

function serialize(row: NotificationRow): NotificationData {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    body: row.body,
    bodyHtml: row.body ? renderMarkdown(row.body) : null,
    link: row.link,
    isRead: row.is_read,
    createdAt: row.created_at,
    readAt: row.read_at,
  };
}

export interface NotificationPayload {
  type: NotificationType;
  title: string;
  body?: string | null;
  link?: string | null;
  /** Ключ идемпотентности (для повторяющихся); при совпадении не создаётся дубль. */
  dedupeKey?: string | null;
  createdBy?: number | null;
}

/** Создаёт одно уведомление. При конфликте `dedupe_key` возвращает null (без ошибки). */
export async function createNotification(userId: number, payload: NotificationPayload) {
  try {
    const row = await prisma.notifications.create({
      data: {
        user_id: userId,
        type: payload.type,
        title: payload.title,
        body: payload.body ?? null,
        link: payload.link ?? null,
        dedupe_key: payload.dedupeKey ?? null,
        created_by: payload.createdBy ?? null,
      },
      select: notificationSelect,
    });
    return serialize(row);
  } catch {
    return null;
  }
}

/** Массовая рассылка одним набором строк (broadcast). Best-effort: ошибки не пробрасываем. */
export async function notifyUsers(userIds: number[], payload: NotificationPayload): Promise<void> {
  const ids = [...new Set(userIds)];
  if (ids.length === 0) return;
  try {
    await prisma.notifications.createMany({
      data: ids.map((userId) => ({
        user_id: userId,
        type: payload.type,
        title: payload.title,
        body: payload.body ?? null,
        link: payload.link ?? null,
        dedupe_key: payload.dedupeKey ?? null,
        created_by: payload.createdBy ?? null,
      })),
      skipDuplicates: true,
    });
  } catch {
    /* уведомление — не критичный побочный эффект, основная операция уже выполнена */
  }
}

/** Рассылка всем пользователям роли. */
export async function notifyRole(role: RoleType, payload: NotificationPayload): Promise<void> {
  const users = await prisma.users.findMany({ where: { role, deleted_at: null }, select: { id: true } });
  await notifyUsers(users.map((user) => user.id), payload);
}

/** Рассылка всем активным пользователям (опционально — кроме одного). */
export async function notifyAll(payload: NotificationPayload, exceptUserId?: number): Promise<void> {
  const users = await prisma.users.findMany({ where: { deleted_at: null }, select: { id: true } });
  await notifyUsers(
    users.map((user) => user.id).filter((id) => id !== exceptUserId),
    payload,
  );
}

export interface NotificationFilter {
  type?: NotificationType;
  limit: number;
  offset: number;
}

/** Список уведомлений текущего пользователя. */
export async function listNotifications(user: CurrentUser, filter: NotificationFilter) {
  const where = { user_id: user.id, ...(filter.type ? { type: filter.type } : {}) };
  const [rows, total, unread] = await Promise.all([
    prisma.notifications.findMany({
      where,
      orderBy: { created_at: 'desc' },
      skip: filter.offset,
      take: filter.limit,
      select: notificationSelect,
    }),
    prisma.notifications.count({ where }),
    prisma.notifications.count({ where: { user_id: user.id, is_read: false } }),
  ]);
  return { notifications: rows.map(serialize), total, unread };
}

export async function unreadCount(user: CurrentUser): Promise<number> {
  return prisma.notifications.count({ where: { user_id: user.id, is_read: false } });
}

export async function markRead(user: CurrentUser, notificationId: number): Promise<void> {
  const row = await prisma.notifications.findFirst({
    where: { id: notificationId, user_id: user.id },
    select: { id: true, is_read: true },
  });
  if (!row) throw httpError(404, 'Уведомление не найдено', 'NOTIFICATION_NOT_FOUND');
  if (!row.is_read) {
    await prisma.notifications.update({ where: { id: notificationId }, data: { is_read: true, read_at: new Date() } });
  }
}

export async function markAllRead(user: CurrentUser): Promise<void> {
  await prisma.notifications.updateMany({
    where: { user_id: user.id, is_read: false },
    data: { is_read: true, read_at: new Date() },
  });
}

/** Целевое сообщение от администратора конкретному пользователю. */
export async function sendAdminMessage(
  actor: CurrentUser,
  rawTargetId: unknown,
  input: { title?: unknown; body?: unknown },
): Promise<NotificationData> {
  if (actor.role !== RoleType.admin) throw httpError(403, 'Действие доступно только администратору', 'FORBIDDEN');
  const targetId = parseId(rawTargetId, 'Некорректный получатель');
  const target = await prisma.users.findFirst({ where: { id: targetId, deleted_at: null }, select: { id: true } });
  if (!target) throw httpError(404, 'Получатель не найден', 'USER_NOT_FOUND');

  const created = await createNotification(targetId, {
    type: NotificationType.admin_message,
    title: requiredText(input.title, 'Заголовок', 255),
    body: optionalText(input.body),
    createdBy: actor.id,
  });
  if (!created) throw httpError(500, 'Не удалось отправить уведомление', 'NOTIFICATION_FAILED');
  return created;
}

/** Порог «давно не активирован» (дней) для уведомления администратору. */
const INACTIVE_NOTIFY_DAYS = 3;

function personName(user: { surname: string | null; name: string | null; email: string }): string {
  const full = [user.surname, user.name].filter(Boolean).join(' ');
  return full || user.email;
}

/**
 * Идемпотентно создаёт администратору уведомления о давно неактивированных аккаунтах.
 * Вызывается при получении списка уведомлений администратором (фоновых задач нет).
 */
export async function ensureInactivityNotifications(actor: CurrentUser): Promise<void> {
  if (actor.role !== RoleType.admin) return;
  try {
    const threshold = new Date(Date.now() - INACTIVE_NOTIFY_DAYS * 24 * 60 * 60 * 1000);
    const stale = await prisma.users.findMany({
      where: {
        deleted_at: null,
        activated_at: null,
        created_at: { lt: threshold },
        id: { not: actor.id },
      },
      select: { id: true, email: true, surname: true, name: true },
    });
    if (stale.length === 0) return;
    await prisma.notifications.createMany({
      data: stale.map((user) => ({
        user_id: actor.id,
        type: NotificationType.account_inactive,
        title: 'Аккаунт не активирован',
        body: `${personName(user)} (${user.email}) не активирован более ${INACTIVE_NOTIFY_DAYS} дн.`,
        link: '/admin/users',
        dedupe_key: `account_inactive:${user.id}`,
        created_by: null,
      })),
      skipDuplicates: true,
    });
  } catch {
    /* best-effort: не мешаем выдаче списка уведомлений */
  }
}
