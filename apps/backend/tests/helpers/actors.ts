// Общие помощники смоук-тестов: dev-администратор и приведение ролей к значениям RoleType.
import { RoleType } from '@arbuz/shared';
import { prisma } from '../../lib/prisma';
import type { CurrentUser } from '../../modules/files/files.service';

/** Возвращает администратора разработки (создаётся `bun seed`). */
export async function requireAdmin(): Promise<CurrentUser> {
  const admin = await prisma.users.findFirst({
    where: { role: RoleType.admin, deleted_at: null },
    select: { id: true, email: true, role: true },
  });
  if (!admin) {
    throw new Error('[smoke] В dev-базе нет администратора — выполните `bun seed`');
  }
  return admin;
}

/** Актор-эксперт для проверок прав. */
export function asExpert(id: number, email: string): CurrentUser {
  return { id, email, role: RoleType.expert };
}
