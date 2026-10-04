// Бизнес-логика управления пользователями (доступ администратора).
import { NotificationType, Prisma, RoleType } from '@arbuz/shared';
import { prisma } from '../../lib/prisma';
import { httpError } from '../../lib/http';
import type { DateRangeFilter, NumberRangeFilter, SortSpec } from '../../lib/query';
import { hashPassword } from '../auth/auth.service';
import { parseEmail, parsePassword } from '../auth/credentials';
import { notifyRole } from '../notifications/notifications.service';

export interface PublicUser {
  id: number;
  email: string;
  role: RoleType;
  surname: string | null;
  name: string | null;
  patronymic: string | null;
  lastActivity: Date;
  createdAt: Date;
  /** null — аккаунт создан админом и ещё не активирован пользователем. */
  activatedAt: Date | null;
  /** Сколько заявок принадлежит пользователю. */
  applicationsCount: number;
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
  activated_at: Date | null;
  _count?: { applications: number } | null;
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
    activatedAt: user.activated_at,
    applicationsCount: user._count?.applications ?? 0,
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
    activated_at: true,
    _count: { select: { applications: true } },
  } as const;
}

export interface UsersFilter {
  /** Мультивыбор ролей (checkbox group). */
  roles?: RoleType[];
  search?: string;
  /** Статус аккаунта: true — активирован, false — не активирован. */
  activated?: boolean;
  /** Диапазон даты создания аккаунта. */
  created?: DateRangeFilter;
  /** Диапазон последней активности. */
  activity?: DateRangeFilter;
  /** Диапазон числа заявок пользователя. */
  apps?: NumberRangeFilter;
  sort?: SortSpec | null;
  limit: number;
  offset: number;
}

function buildWhere(filter: UsersFilter): Prisma.usersWhereInput {
  return {
    deleted_at: null,
    ...(filter.roles?.length ? { role: { in: filter.roles } } : {}),
    ...(filter.activated === true ? { activated_at: { not: null } } : {}),
    ...(filter.activated === false ? { activated_at: null } : {}),
    ...(filter.search
      ? {
          OR: [
            { email: { contains: filter.search, mode: 'insensitive' } },
            { surname: { contains: filter.search, mode: 'insensitive' } },
            { name: { contains: filter.search, mode: 'insensitive' } },
            { patronymic: { contains: filter.search, mode: 'insensitive' } },
          ],
        }
      : {}),
    ...(filter.created ? { created_at: filter.created } : {}),
    ...(filter.activity ? { last_activity: filter.activity } : {}),
  };
}

/** Порядок по умолчанию: неактивированные — первыми (nulls first), затем по id. */
const DEFAULT_USERS_ORDER: Prisma.usersOrderByWithRelationInput[] = [
  { activated_at: { sort: 'asc', nulls: 'first' } },
  { id: 'asc' },
];

function usersOrderBy(sort: SortSpec | null | undefined): Prisma.usersOrderByWithRelationInput[] {
  if (!sort) return DEFAULT_USERS_ORDER;
  const direction = sort.direction;
  switch (sort.field) {
    case 'id':
      return [{ id: direction }];
    case 'email':
      return [{ email: direction }];
    case 'name':
      return [{ surname: direction }, { name: direction }];
    case 'role':
      return [{ role: direction }];
    case 'created_at':
      return [{ created_at: direction }];
    case 'last_activity':
      return [{ last_activity: direction }];
    case 'activated_at':
      return [{ activated_at: { sort: direction, nulls: 'last' } }];
    case 'applications':
      return [{ applications: { _count: direction } }];
    default:
      return [{ id: 'asc' }];
  }
}

export async function listUsers(filter: UsersFilter) {
  const where = buildWhere(filter);
  const orderBy = usersOrderBy(filter.sort);
  const hasCountFilter = filter.apps !== undefined;

  // Фильтр по числу заявок: Prisma не умеет диапазон по счётчику связи,
  // поэтому считаем в памяти (таблица пользователей небольшая).
  if (hasCountFilter && filter.apps && (filter.apps.min !== undefined || filter.apps.max !== undefined)) {
    const all = await prisma.users.findMany({ where, orderBy, select: userSelect() });
    const inRange = all.filter((user) => {
      const count = user._count.applications;
      if (filter.apps!.min !== undefined && count < filter.apps!.min) return false;
      if (filter.apps!.max !== undefined && count > filter.apps!.max) return false;
      return true;
    });
    const page = inRange.slice(filter.offset, filter.offset + filter.limit);
    return { users: page.map(serialize), total: inRange.length };
  }

  const [users, total] = await Promise.all([
    prisma.users.findMany({ where, orderBy, skip: filter.offset, take: filter.limit, select: userSelect() }),
    prisma.users.count({ where }),
  ]);
  return { users: users.map(serialize), total };
}

export async function getUserOrThrow(userId: number): Promise<PublicUser> {
  const user = await prisma.users.findFirst({ where: { id: userId, deleted_at: null }, select: userSelect() });
  if (!user) throw httpError(404, 'Пользователь не найден', 'USER_NOT_FOUND');
  return serialize(user);
}

/** Все активные эксперты (для селекта назначения); неактивированные не предлагаются. */
export function listExperts() {
  return prisma.users.findMany({
    where: { role: RoleType.expert, deleted_at: null, activated_at: { not: null } },
    orderBy: { id: 'asc' },
    select: { id: true, email: true, name: true, surname: true, patronymic: true },
  });
}

export async function createUser(actorId: number, input: UserInput): Promise<PublicUser> {
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
      // Администратор — сотрудник оператора: активен сразу. Остальные созданные
      // админом аккаунты неактивны до принятия ПС/ПДн самим пользователем.
      activated_at: role === RoleType.admin ? new Date() : null,
      created_by: actorId,
    },
    select: userSelect(),
  });
  // Уведомляем администраторов о новом пользователе.
  await notifyRole(RoleType.admin, {
    type: NotificationType.account_created,
    title: 'Создан новый пользователь',
    body: `${email} (роль: ${role})`,
    link: '/admin/users',
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
