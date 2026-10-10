// Сервис аутентификации: пароли (argon2id через Bun) и JWT-токены сессии.
// Токен не зависит от конкретного провайдера входа — в будущем «Госуслуги/ВК»
// будут выпускать тот же самый токен, поэтому архитектура не меняется.
import { SignJWT, jwtVerify } from 'jose';
import { NotificationType, RoleType } from '@arbuz/shared';
import { config } from '../../lib/config';
import { prisma } from '../../lib/prisma';
import { httpError } from '../../lib/http';
import { parseEmail, parsePassword } from './credentials';
import {
  buildConsentEvents,
  requireRegistrationConsents,
  type ConsentRequestMeta,
} from '../consents/consents.service';
import { notifyRole, notifyNewUserAboutRecentPosts } from '../notifications/notifications.service';

export interface SessionUser {
  id: number;
  role: RoleType;
}

export interface PublicUser {
  id: number;
  email: string;
  role: RoleType;
  surname: string | null;
  name: string | null;
  patronymic: string | null;
  regionId: number | null;
  regionName: string | null;
  /** null — аккаунт создан админом и ещё не активирован пользователем. */
  activatedAt: Date | null;
}

const secret = new TextEncoder().encode(config.jwt.secret);

export function hashPassword(password: string): Promise<string> {
  return Bun.password.hash(password, { algorithm: 'argon2id' });
}

export function verifyPassword(password: string, hash: string): Promise<boolean> {
  return Bun.password.verify(password, hash);
}

export async function signSession(user: SessionUser): Promise<string> {
  return new SignJWT({ role: user.role })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(String(user.id))
    .setIssuedAt()
    .setExpirationTime(config.jwt.expiresIn)
    .sign(secret);
}

export async function verifySession(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, secret);
    if (!payload.sub) return null;
    const role = parseRoleClaim(payload.role);
    if (!role) return null;
    return { id: Number(payload.sub), role };
  } catch {
    return null;
  }
}

/** Проверяет значение роли из JWT (не доверяем утверждению вслепую). */
function parseRoleClaim(value: unknown): RoleType | null {
  return value === RoleType.admin || value === RoleType.expert || value === RoleType.applicant ? value : null;
}

function optionalName(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text.length ? text.slice(0, 100) : null;
}

export interface RegisterInput {
  email: unknown;
  password: unknown;
  surname?: unknown;
  name?: unknown;
  patronymic?: unknown;
  region_id?: unknown;
  /** Обязательное принятие пользовательского соглашения. */
  accept_terms?: unknown;
  /** Обязательное согласие на обработку персональных данных. */
  accept_personal_data_consent?: unknown;
}

/** Резолвит id региона (или null); проверяет существование. */
async function resolveRegionId(value: unknown): Promise<number | null> {
  if (value === undefined || value === null || value === '') return null;
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) throw httpError(400, 'Некорректный регион', 'INVALID_REGION');
  const region = await prisma.regions.findFirst({ where: { id, deleted_at: null }, select: { id: true } });
  if (!region) throw httpError(404, 'Регион не найден', 'REGION_NOT_FOUND');
  return id;
}

/** Саморегистрация заявителя (роль всегда applicant). */
export async function registerApplicant(input: RegisterInput, meta: ConsentRequestMeta) {
  const email = parseEmail(input.email);
  const password = parsePassword(input.password);

  const existing = await prisma.users.findUnique({ where: { email }, select: { id: true } });
  if (existing) throw httpError(409, 'Пользователь с таким email уже существует', 'EMAIL_TAKEN');

  // Оба согласия обязательны (152-ФЗ): проверяем до создания пользователя и
  // фиксируем принятие в журнале — вместе с созданием пользователя, одной транзакцией.
  const documents = await requireRegistrationConsents({
    accept_terms: input.accept_terms,
    accept_personal_data_consent: input.accept_personal_data_consent,
  });
  const passwordHash = await hashPassword(password);
  const regionId = await resolveRegionId(input.region_id);

  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.users.create({
      data: {
        email,
        password_hash: passwordHash,
        role: RoleType.applicant,
        surname: optionalName(input.surname),
        name: optionalName(input.name),
        patronymic: optionalName(input.patronymic),
        region_id: regionId,
        // Саморегистрация: пользователь сразу принял ПС/ПДн → аккаунт активен.
        activated_at: new Date(),
      },
    });
    await tx.consent_events.createMany({ data: buildConsentEvents(created.id, documents, meta) });
    return created;
  });

  // Уведомляем администраторов о новой саморегистрации.
  await notifyRole(RoleType.admin, {
    type: NotificationType.account_created,
    title: 'Новый пользователь',
    body: `${email} зарегистрировался самостоятельно.`,
    link: '/admin/users',
  });
  // Новому пользователю — уведомления о 10 последних новостях (включая закреплённые).
  await notifyNewUserAboutRecentPosts(user.id);

  return user;
}

export interface ActivateInput {
  surname?: unknown;
  name?: unknown;
  patronymic?: unknown;
  region_id?: unknown;
  /** Необязательная смена пароля (если задан — должен проходить политику). */
  password?: unknown;
  accept_terms?: unknown;
  accept_personal_data_consent?: unknown;
}

/**
 * Активация аккаунта, созданного администратором: пользователь подтверждает/правит данные,
 * (опционально) меняет пароль и обязательно принимает ПС и ПДн. До этого аккаунт неактивен.
 */
export async function activateAccount(userId: number, input: ActivateInput, meta: ConsentRequestMeta) {
  const existing = await prisma.users.findFirst({
    where: { id: userId, deleted_at: null },
    select: { id: true, activated_at: true },
  });
  if (!existing) throw httpError(404, 'Пользователь не найден', 'USER_NOT_FOUND');
  if (existing.activated_at) throw httpError(409, 'Аккаунт уже активирован', 'ALREADY_ACTIVATED');

  // Оба согласия обязательны (152-ФЗ): фиксируем принятие вместе с активацией.
  const documents = await requireRegistrationConsents({
    accept_terms: input.accept_terms,
    accept_personal_data_consent: input.accept_personal_data_consent,
  });

  const data: {
    activated_at: Date;
    surname?: string | null;
    name?: string | null;
    patronymic?: string | null;
    region_id?: number | null;
    password_hash?: string;
  } = { activated_at: new Date() };

  if (input.surname !== undefined) data.surname = optionalName(input.surname);
  if (input.name !== undefined) data.name = optionalName(input.name);
  if (input.patronymic !== undefined) data.patronymic = optionalName(input.patronymic);
  if (input.region_id !== undefined) data.region_id = await resolveRegionId(input.region_id);
  if (input.password !== undefined && input.password !== null && String(input.password) !== '') {
    data.password_hash = await hashPassword(parsePassword(input.password));
  }

  return prisma.$transaction(async (tx) => {
    const user = await tx.users.update({ where: { id: userId }, data });
    await tx.consent_events.createMany({ data: buildConsentEvents(userId, documents, meta) });
    return user;
  });
}
