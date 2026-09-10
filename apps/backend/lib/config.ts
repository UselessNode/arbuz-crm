// Конфигурация приложения: читается из окружения (корневой .env подгружает dotenv-cli).
import { randomBytes } from 'node:crypto';
import path from 'node:path';
import { BACKEND_ROOT } from './paths';

const nodeEnv = process.env.NODE_ENV ?? 'development';
const isProduction = nodeEnv === 'production';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`[config] Переменная окружения ${name} не задана (см. .env.example)`);
  }
  return value;
}

function resolveJwtSecret(): string {
  const raw = process.env.JWT_SECRET;
  if (!raw || raw === 'change-me') {
    if (isProduction) {
      throw new Error('[config] JWT_SECRET обязателен в production и не должен быть "change-me"');
    }
    const secret = randomBytes(32).toString('hex');
    console.warn('[config] JWT_SECRET не задан (dev): секрет сгенерирован на время запуска.');
    return secret;
  }
  return raw;
}

export const config = {
  nodeEnv,
  isProduction,
  port: Number(process.env.PORT) || 3000,
  databaseUrl: requireEnv('DATABASE_URL'),
  jwt: {
    secret: resolveJwtSecret(),
    expiresIn: '12h',
    cookieMaxAgeMs: 12 * 60 * 60 * 1000,
    cookieName: 'arbuz_session',
  },
  uploads: {
    // Физический каталог с файлами; по умолчанию ./uploads относительно пакета backend
    // (не зависит от рабочего каталога запуска).
    dir: path.resolve(BACKEND_ROOT, process.env.UPLOAD_DIR ?? './uploads'),
  },
  limits: {
    // Один файл до 10 МБ, суммарно на заявку до 25 МБ.
    maxFileBytes: 10 * 1024 * 1024,
    maxApplicationBytes: 25 * 1024 * 1024,
  },
} as const;
