// Роли проекта (значения совпадают с RoleType на бэкенде).
import type { RoleType } from '@arbuz/shared';

export const Roles = {
  admin: 'admin',
  expert: 'expert',
  applicant: 'applicant',
} as const satisfies Record<RoleType, RoleType>;

/** Стартовая страница пользователя после входа (зависит от роли). */
export function homePathForRole(role: RoleType): string {
  if (role === Roles.admin) return '/admin';
  if (role === Roles.applicant) return '/applications';
  return '/account';
}
