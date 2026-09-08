// Сервис аутентификации: пароли (argon2id через Bun) и JWT-токены сессии.
// Токен не зависит от конкретного провайдера входа — в будущем «Госуслуги/ВК»
// будут выпускать тот же самый токен, поэтому архитектура не меняется.
import { SignJWT, jwtVerify } from 'jose';
import type { RoleType } from '@arbuz/shared';
import { config } from '../../lib/config';

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
    return { id: Number(payload.sub), role: payload.role as RoleType };
  } catch {
    return null;
  }
}
