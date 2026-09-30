// Ролевое оформление каркаса: элементы навигации, цвет и заголовок шапки.
import type { RoleType } from '@arbuz/shared';
import type { IconName } from '../components/ui';
import { Roles } from '../lib/roles';
import styles from './AppLayout.module.css';

export interface NavItem {
  to: string;
  label: string;
  icon: IconName;
  hidden?: boolean;
}

const ADMIN_NAV: NavItem[] = [
  { to: '/admin/users',         label: 'Пользователи',            icon: 'users',      hidden: false },
  { to: '/admin/applications',  label: 'Заявки',                  icon: 'document',   hidden: false },
  { to: '/admin/reviews',       label: 'Экспертизы',              icon: 'check',      hidden: false },
  { to: '/admin/posts',         label: 'Публикации',              icon: 'chat',       hidden: false },
  { to: '/admin/documents',     label: 'Документы и согласия',   icon: 'document',   hidden: false },
  { to: '/admin/contests',      label: 'Конкурсы и направления',  icon: 'briefcase',  hidden: false },
  { to: '/admin/expertise',     label: 'Настройки экспертизы',    icon: 'filter',     hidden: false },
  { to: '/design-system',       label: 'Дизайн-система',          icon: 'settings',   hidden: true  },
];

const ACCOUNT_NAV: NavItem[] = [
  { to: '/account', label: 'Профиль', icon: 'user', hidden: false },
];

const APPLICANT_NAV: NavItem[] = [
  { to: '/applications',  label: 'Мои заявки',  icon: 'document', hidden: false },
  { to: '/account',       label: 'Профиль',     icon: 'user',     hidden: false },
];

const EXPERT_NAV: NavItem[] = [
  { to: '/expert',  label: 'Назначенные заявки', icon: 'check', hidden: false },
  { to: '/account', label: 'Профиль',            icon: 'user',  hidden: false },
];

export function navItemsForRole(role: RoleType): NavItem[] {
  if (role === Roles.admin) return ADMIN_NAV;
  if (role === Roles.applicant) return APPLICANT_NAV;
  if (role === Roles.expert) return EXPERT_NAV;
  return ACCOUNT_NAV;
}

export function headerClassForRole(role: RoleType): string {
  if (role === Roles.admin) return styles.headerAdmin;
  if (role === Roles.expert) return styles.headerExpert;
  return styles.headerApplicant;
}

export function titleForRole(role: RoleType): string {
  if (role === Roles.admin) return 'Панель администратора';
  if (role === Roles.expert) return 'Кабинет эксперта';
  return 'Личный кабинет';
}
