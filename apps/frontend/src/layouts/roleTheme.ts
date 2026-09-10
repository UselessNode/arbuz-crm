// Ролевое оформление каркаса: элементы навигации, цвет и заголовок шапки.
import type { RoleType } from '@arbuz/shared';
import type { IconName } from '../components/ui';
import { Roles } from '../lib/roles';
import styles from './AppLayout.module.css';

export interface NavItem {
  to: string;
  label: string;
  icon: IconName;
}

const ADMIN_NAV: NavItem[] = [
  { to: '/admin/users', label: 'Пользователи', icon: 'users' },
  { to: '/admin/applications', label: 'Заявки', icon: 'document' },
  { to: '/admin/reviews', label: 'Рецензии', icon: 'check' },
  { to: '/admin/posts', label: 'Посты', icon: 'chat' },
  { to: '/admin/tenders', label: 'Конкурсы', icon: 'briefcase' },
  { to: '/admin/directions', label: 'Направления', icon: 'folder' },
  { to: '/admin/statuses', label: 'Статусы заявок', icon: 'filter' },
  { to: '/admin/design-system', label: 'Дизайн-система', icon: 'settings' },
];

const ACCOUNT_NAV: NavItem[] = [{ to: '/account', label: 'Профиль', icon: 'user' }];

const APPLICANT_NAV: NavItem[] = [
  { to: '/applications', label: 'Мои заявки', icon: 'document' },
  { to: '/account', label: 'Профиль', icon: 'user' },
];

// TODO(MVP-3): эксперту — «Экспертизы».
export function navItemsForRole(role: RoleType): NavItem[] {
  if (role === Roles.admin) return ADMIN_NAV;
  if (role === Roles.applicant) return APPLICANT_NAV;
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
