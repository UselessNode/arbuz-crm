// Пользователи seed: администратор и демо-участники.
import type { RoleType } from '@arbuz/shared';
import { prisma } from '../lib/prisma';
import { log } from '../lib/logger';
import { hashPassword } from '../modules/auth/auth.service';
import type { SeedUser } from './data';

export interface UserInput {
  email: string;
  password: string;
  role: RoleType;
  surname?: string;
  name?: string;
  patronymic?: string;
}

/** Подставляет значения из переменных окружения (env перекрывает значение по умолчанию). */
export function resolveSeedUser(seed: SeedUser): UserInput {
  return {
    email: process.env[seed.emailEnv] ?? seed.email,
    password: process.env[seed.passwordEnv] ?? seed.password,
    role: seed.role,
    surname: seed.surname,
    name: seed.name,
    patronymic: seed.patronymic,
  };
}

/** Создаёт пользователя, если его ещё нет (идемпотентно по email). */
export async function ensureUser(input: UserInput) {
  const email = input.email.trim().toLowerCase();
  const existing = await prisma.users.findUnique({ where: { email } });
  if (existing) {
    log.info('seed: пользователь уже существует', { email, role: input.role });
    return existing;
  }
  const user = await prisma.users.create({
    data: {
      email,
      password_hash: await hashPassword(input.password),
      role: input.role,
      surname: input.surname ?? null,
      name: input.name ?? null,
      patronymic: input.patronymic ?? null,
      // Демо-аккаунты считаются уже активированными.
      activated_at: new Date(),
    },
  });
  log.info('seed: создан пользователь', { id: user.id, email, role: input.role });
  return user;
}
