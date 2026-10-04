// Типы уведомлений (значения совпадают с NotificationType на бэкенде).
//
// Рантайм-значения зеркалим локально, как роли (`lib/roles.ts`) и статусы публикаций
// (`lib/post-status.ts`): импорт значений из `@arbuz/shared` тянет в бандл сгенерированный
// Prisma-клиент (CommonJS) и ломает браузер. Тип — только type-only.
import type { NotificationType as NotificationTypeValue } from '@arbuz/shared';
import type { BadgeTone, IconName } from '../components/ui';

export const NotificationTypes = {
  application_status: 'application_status',
  expert_assignment: 'expert_assignment',
  account_inactive: 'account_inactive',
  account_created: 'account_created',
  publication: 'publication',
  document: 'document',
  admin_message: 'admin_message',
} as const satisfies Record<NotificationTypeValue, NotificationTypeValue>;

/** Тип уведомления (значения совпадают с `NotificationTypes`). */
export type NotificationType = NotificationTypeValue;

interface NotificationTypeMeta {
  label: string;
  icon: IconName;
  tone: BadgeTone;
}

/** Человекочитаемая метка, иконка и цвет для каждого типа (фильтры и список). */
export const NOTIFICATION_TYPE_META: Record<NotificationType, NotificationTypeMeta> = {
  application_status: { label: 'Статус заявки', icon: 'briefcase', tone: 'blue' },
  expert_assignment: { label: 'Экспертиза', icon: 'users', tone: 'purple' },
  account_inactive: { label: 'Неактивный аккаунт', icon: 'warning', tone: 'yellow' },
  account_created: { label: 'Новый пользователь', icon: 'user-plus', tone: 'green' },
  publication: { label: 'Публикация', icon: 'news', tone: 'cyan' },
  document: { label: 'Документ', icon: 'document', tone: 'teal' },
  admin_message: { label: 'Сообщение', icon: 'chat', tone: 'orange' },
};

/** Порядок типов в фильтре (как в справочнике). */
export const NOTIFICATION_TYPES: readonly NotificationType[] = Object.values(NotificationTypes);
