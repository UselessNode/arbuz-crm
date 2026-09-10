// Роли проекта (значения совпадают с RoleType на бэкенде).
import type { RoleType } from '@arbuz/shared';

export const Roles = {
  admin: 'admin',
  expert: 'expert',
  applicant: 'applicant',
} as const satisfies Record<RoleType, RoleType>;
