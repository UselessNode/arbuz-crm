// Сервис аутентификации: пароли (argon2id через Bun) и JWT-токены сессии.
// Токен не зависит от конкретного провайдера входа — в будущем «Госуслуги/ВК»
// будут выпускать тот же самый токен, поэтому архитектура не меняется.
import { SignJWT, jwtVerify } from 'jose';
import { RoleType } from '@arbuz/shared';
import { config } from '../../lib/config';
import { prisma } from '../../lib/prisma';
import { httpError } from '../../lib/http';
import { parseEmail, parsePassword } from './credentials';
import {
  buildConsentEvents,
  requireRegistrationConsents,
  type ConsentRequestMeta,
} from '../consents/consents.service';

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
  /** Обязательное принятие пользовательского соглашения. */
  accept_terms?: unknown;
  /** Обязательное согласие на обработку персональных данных. */
  accept_personal_data_consent?: unknown;
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

  return prisma.$transaction(async (tx) => {
    const user = await tx.users.create({
      data: {
        email,
        password_hash: passwordHash,
        role: RoleType.applicant,
        surname: optionalName(input.surname),
        name: optionalName(input.name),
        patronymic: optionalName(input.patronymic),
      },
    });
    await tx.consent_events.createMany({ data: buildConsentEvents(user.id, documents, meta) });
    return user;
  });
}
