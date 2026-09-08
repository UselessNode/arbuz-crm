// Логирование: структурированные строки JSON в stdout + журнал аудита (logs/audit.log).
import { appendFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';

const auditFile = path.resolve(process.cwd(), 'logs', 'audit.log');
mkdirSync(path.dirname(auditFile), { recursive: true });

function writeLine(payload: Record<string, unknown>): void {
  const line = JSON.stringify({ ts: new Date().toISOString(), ...payload });
  console.log(line);
  try {
    appendFileSync(auditFile, `${line}\n`, 'utf8');
  } catch (error) {
    console.error('[logger] не удалось записать audit.log:', error);
  }
}

export const log = {
  info(message: string, meta: Record<string, unknown> = {}): void {
    writeLine({ level: 'info', message, ...meta });
  },
  warn(message: string, meta: Record<string, unknown> = {}): void {
    writeLine({ level: 'warn', message, ...meta });
  },
  error(message: string, meta: Record<string, unknown> = {}): void {
    writeLine({ level: 'error', message, ...meta });
  },
  /** Действия пользователей для аудита: загрузка/скачивание/удаление файлов, вход и т.п. */
  audit(event: string, meta: Record<string, unknown> = {}): void {
    writeLine({ level: 'audit', event, ...meta });
  },
};
