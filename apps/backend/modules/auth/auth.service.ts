// Сервис аутентификации: пароли (argon2id через Bun) и JWT-токены сессии.
// Токен не зависит от конкретного провайдера входа — в будущем «Госуслуги/ВК»
// будут выпускать тот же самый токен, поэтому архитектура не меняется.
import { SignJWT, jwtVerify } from 'jose';
import { RoleType } from '@arbuz/shared';
import { config } from '../../lib/config';
import { prisma } from '../../lib/prisma';
import { httpError } from '../../lib/http';
import { parseEmail, parsePassword } from './credentials';

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
}

/** Саморегистрация заявителя (роль всегда applicant). */
export async function registerApplicant(input: RegisterInput) {
  const email = parseEmail(input.email);
  const password = parsePassword(input.password);

  const existing = await prisma.users.findUnique({ where: { email }, select: { id: true } });
  if (existing) throw httpError(409, 'Пользователь с таким email уже существует', 'EMAIL_TAKEN');

  return prisma.users.create({
    data: {
      email,
      password_hash: await hashPassword(password),
      role: RoleType.applicant,
      surname: optionalName(input.surname),
      name: optionalName(input.name),
      patronymic: optionalName(input.patronymic),
    },
  });
}
