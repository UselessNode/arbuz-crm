// Смоук: центр уведомлений (создание, целевое сообщение, отметка прочитанным, dedupe).
import { NotificationType, RoleType } from '@arbuz/shared';
import { prisma } from '../../lib/prisma';
import { createUser } from '../../modules/users/users.service';
import {
  createNotification,
  listNotifications,
  markAllRead,
  markRead,
  sendAdminMessage,
  unreadCount,
} from '../../modules/notifications/notifications.service';
import { createSmoke } from '../helpers/smoke';
import { requireAdmin } from '../helpers/actors';

const smoke = createSmoke('notifications (центр уведомлений)');

async function main(): Promise<void> {
  const admin = await requireAdmin();
  const stamp = Date.now();
  const email = `smoke-notify-${stamp}@arbuz.local`;
  let userId: number | null = null;

  try {
    // Созданный админом пользователь → администраторам уходит уведомление о новом аккаунте.
    const before = await unreadCount(admin);
    const created = await createUser(admin.id, { email, password: 'password123', role: RoleType.applicant });
    userId = created.id;
    const afterCreate = await unreadCount(admin);
    smoke.ok('новый пользователь уведомляет администратора', afterCreate > before, { before, afterCreate });

    const target = { id: userId, email, role: RoleType.applicant };

    // Целевое сообщение администратора конкретному пользователю.
    const message = await sendAdminMessage(admin, userId, { title: 'Проверка', body: 'Текст **Markdown**' });
    smoke.eq('целевое сообщение: тип admin_message', message.type, NotificationType.admin_message);
    smoke.ok('целевое сообщение: Markdown отрендерен в HTML', Boolean(message.bodyHtml?.includes('<strong>')));

    const list = await listNotifications(target, { limit: 20, offset: 0 });
    smoke.ok('получатель видит своё сообщение', list.notifications.some((row) => row.id === message.id));
    smoke.eq('у получателя одно непрочитанное', await unreadCount(target), 1);

    // Пометка одного прочитанным.
    await markRead(target, message.id);
    smoke.eq('после отметки непрочитанных нет', await unreadCount(target), 0);

    // Идемпотентность по dedupeKey.
    const dedupeKey = `smoke-dedupe-${stamp}`;
    const first = await createNotification(userId, { type: NotificationType.admin_message, title: 'Дубль', dedupeKey });
    const second = await createNotification(userId, { type: NotificationType.admin_message, title: 'Дубль', dedupeKey });
    smoke.ok('первое уведомление создано', first !== null);
    smoke.eq('повтор по dedupeKey пропущен', second, null);

    // «Прочитать все».
    await markAllRead(target);
    smoke.eq('после «прочитать все» непрочитанных нет', await unreadCount(target), 0);
  } finally {
    if (userId !== null) await prisma.users.delete({ where: { id: userId } }).catch(() => undefined);
    // Уведомления администраторам о новом пользователе (в теле — email) не привязаны к удаляемому.
    await prisma.notifications.deleteMany({ where: { body: { contains: email } } }).catch(() => undefined);
    await prisma.$disconnect();
  }

  smoke.done();
}

await main();
