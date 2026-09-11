// Бизнес-логика управления пользователями (доступ администратора).
import { RoleType } from '@arbuz/shared';
import { prisma } from '../../lib/prisma';
import { httpError } from '../../lib/http';
import { hashPassword } from '../auth/auth.service';
import { parseEmail, parsePassword } from '../auth/credentials';

export interface PublicUser {
  id: number;
  email: string;
  role: RoleType;
  surname: string | null;
  name: string | null;
  patronymic: string | null;
  lastActivity: Date;
  createdAt: Date;
}

export interface UserInput {
  email: string;
  password: string;
  role: RoleType;
  surname?: string | null;
  name?: string | null;
  patronymic?: string | null;
}

export const PASSWORD_MIN_LENGTH = 8;

const ROLE_VALUES: readonly RoleType[] = [RoleType.admin, RoleType.expert, RoleType.applicant];

function parseRole(value: unknown): RoleType {
  if (typeof value !== 'string' || !(ROLE_VALUES as readonly string[]).includes(value)) {
    throw httpError(400, 'Недопустимая роль', 'INVALID_ROLE');
  }
  return value as RoleType;
}

function optionalText(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text.length ? text.slice(0, 100) : null;
}

function serialize(user: {
  id: number;
  email: string;
  role: RoleType;
  surname: string | null;
  name: string | null;
  patronymic: string | null;
  last_activity: Date;
  created_at: Date;
}): PublicUser {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    surname: user.surname,
    name: user.name,
    patronymic: user.patronymic,
    lastActivity: user.last_activity,
    createdAt: user.created_at,
  };
}

function userSelect() {
  return {
    id: true,
    email: true,
    role: true,
    surname: true,
    name: true,
    patronymic: true,
    last_activity: true,
    created_at: true,
  } as const;
}

export async function listUsers(filter: { role?: RoleType; search?: string; limit: number; offset: number }) {
  const where = {
    deleted_at: null,
    ...(filter.role ? { role: filter.role } : {}),
    ...(filter.search
      ? {
          OR: [
            { email: { contains: filter.search, mode: 'insensitive' as const } },
            { surname: { contains: filter.search, mode: 'insensitive' as const } },
            { name: { contains: filter.search, mode: 'insensitive' as const } },
            { patronymic: { contains: filter.search, mode: 'insensitive' as const } },
          ],
        }
      : {}),
  };
  const [users, total] = await Promise.all([
    prisma.users.findMany({ where, orderBy: { id: 'asc' }, skip: filter.offset, take: filter.limit, select: userSelect() }),
    prisma.users.count({ where }),
  ]);
  return { users: users.map(serialize), total };
}

export async function getUserOrThrow(userId: number): Promise<PublicUser> {
  const user = await prisma.users.findFirst({ where: { id: userId, deleted_at: null }, select: userSelect() });
  if (!user) throw httpError(404, 'Пользователь не найден', 'USER_NOT_FOUND');
  return serialize(user);
}

/** Все эксперты (для селекта назначения), без пагинации. */
export function listExperts() {
  return prisma.users.findMany({
    where: { role: RoleType.expert, deleted_at: null },
    orderBy: { id: 'asc' },
    select: { id: true, email: true, name: true, surname: true, patronymic: true },
  });
}

export async function createUser(_actorId: number, input: UserInput): Promise<PublicUser> {
  const email = parseEmail(input.email);
  const password = parsePassword(input.password);
  const role = parseRole(input.role);

  const existing = await prisma.users.findUnique({ where: { email } });
  if (existing) throw httpError(409, 'Пользователь с таким email уже существует', 'EMAIL_TAKEN');

  const user = await prisma.users.create({
    data: {
      email,
      password_hash: await hashPassword(password),
      role,
      surname: optionalText(input.surname),
      name: optionalText(input.name),
      patronymic: optionalText(input.patronymic),
    },
    select: userSelect(),
  });
  return serialize(user);
}

export async function updateUser(
  actorId: number,
  userId: number,
  patch: { email?: unknown; role?: unknown; surname?: unknown; name?: unknown; patronymic?: unknown },
): Promise<PublicUser> {
  const existing = await prisma.users.findFirst({ where: { id: userId, deleted_at: null } });
  if (!existing) throw httpError(404, 'Пользователь не найден', 'USER_NOT_FOUND');

  const data: { email?: string; role?: RoleType; surname?: string | null; name?: string | null; patronymic?: string | null } = {};

  if (patch.role !== undefined) {
    const role = parseRole(patch.role);
    // Администратор не должен понижать сам себя (защита от потери доступа).
    if (userId === actorId && role !== RoleType.admin) {
      throw httpError(403, 'Нельзя изменить собственную роль', 'SELF_ROLE_CHANGE_FORBIDDEN');
    }
    data.role = role;
  }
  if (patch.email !== undefined) {
    const email = parseEmail(patch.email);
    if (email !== existing.email) {
      const taken = await prisma.users.findUnique({ where: { email } });
      if (taken && taken.id !== userId) throw httpError(409, 'Пользователь с таким email уже существует', 'EMAIL_TAKEN');
    }
    data.email = email;
  }
  if (patch.surname !== undefined) data.surname = optionalText(patch.surname);
  if (patch.name !== undefined) data.name = optionalText(patch.name);
  if (patch.patronymic !== undefined) data.patronymic = optionalText(patch.patronymic);

  const user = await prisma.users.update({ where: { id: userId }, data, select: userSelect() });
  return serialize(user);
}

export async function resetPassword(_actorId: number, userId: number, rawPassword: unknown): Promise<void> {
  const existing = await prisma.users.findFirst({ where: { id: userId, deleted_at: null }, select: { id: true } });
  if (!existing) throw httpError(404, 'Пользователь не найден', 'USER_NOT_FOUND');
  const password = parsePassword(rawPassword);
  await prisma.users.update({ where: { id: userId }, data: { password_hash: await hashPassword(password) } });
}

export async function deleteUser(actorId: number, userId: number): Promise<void> {
  if (userId === actorId) {
    throw httpError(403, 'Нельзя удалить собственную учётную запись', 'SELF_DELETE_FORBIDDEN');
  }
  const existing = await prisma.users.findFirst({ where: { id: userId, deleted_at: null }, select: { id: true } });
  if (!existing) throw httpError(404, 'Пользователь не найден', 'USER_NOT_FOUND');
  await prisma.users.update({ where: { id: userId }, data: { deleted_at: new Date() } });
}
