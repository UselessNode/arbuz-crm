// Обслуживание дискового хранилища (запускать по cron, напр. еженедельно):
//  1) удаляет физические файлы записей, помеченных deleted_at давнее N дней;
//  2) удаляет «осиротевшие» файлы (нет ссылки в БД) старше M часов;
//  3) подчищает пустые каталоги.
// Переменные: CLEANUP_AFTER_DAYS (по умолчанию 7), CLEANUP_ORPHAN_AFTER_HOURS (24).
import { readdir, stat, unlink, rm } from 'node:fs/promises';
import path from 'node:path';
import { config } from '../lib/config';
import { prisma } from '../lib/prisma';
import { log } from '../lib/logger';
import { toPhysical, toRelativePath } from '../modules/files/file-storage';

const deletedAfterDays = Number(process.env.CLEANUP_AFTER_DAYS ?? 7);
const orphanAfterHours = Number(process.env.CLEANUP_ORPHAN_AFTER_HOURS ?? 24);

async function removePhysical(relativePath: string): Promise<void> {
  try {
    await unlink(toPhysical(relativePath));
    log.info('storage:cleanup: удалён файл', { path: relativePath });
  } catch {
    // Отсутствующий или некорректный путь не считаем ошибкой.
  }
}

async function cleanupDeletedRows(): Promise<void> {
  const threshold = new Date(Date.now() - deletedAfterDays * 24 * 60 * 60 * 1000);
  const [materials, consents] = await Promise.all([
    prisma.additional_materials.findMany({ where: { deleted_at: { not: null, lt: threshold } }, select: { file_path: true } }),
    prisma.consent_files.findMany({ where: { deleted_at: { not: null, lt: threshold } }, select: { file_path: true } }),
  ]);
  for (const row of [...materials, ...consents]) {
    await removePhysical(row.file_path);
  }
}

async function collectKnownPaths(): Promise<Set<string>> {
  const [materials, consents, files] = await Promise.all([
    prisma.additional_materials.findMany({ select: { file_path: true } }),
    prisma.consent_files.findMany({ select: { file_path: true } }),
    prisma.files.findMany({ select: { path: true } }),
  ]);
  // Физические файлы лежат непосредственно в config.uploads.dir, а пути в БД
  // содержат namespace-префикс `uploads/`; приводим их к единому виду (toRelativePath).
  const known = new Set<string>();
  const add = (relativePath: string | null): void => {
    if (!relativePath) return;
    known.add(toRelativePath(relativePath));
  };
  for (const row of materials) add(row.file_path);
  for (const row of consents) add(row.file_path);
  for (const row of files) add(row.path);
  return known;
}

async function cleanupOrphans(): Promise<{ removedFiles: number }> {
  const known = await collectKnownPaths();
  const root = path.resolve(config.uploads.dir);
  let removed = 0;
  const orphanThresholdMs = Date.now() - orphanAfterHours * 60 * 60 * 1000;

  // Возвращает true, если каталог пуст (после обработки).
  async function walk(dir: string): Promise<boolean> {
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return true;
    }
    let hasContent = false;
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        const empty = await walk(full);
        if (!empty) hasContent = true;
      } else if (entry.isFile()) {
        const rel = path.relative(root, full);
        if (!known.has(rel)) {
          const info = await stat(full);
          if (info.mtimeMs < orphanThresholdMs) {
            await unlink(full);
            removed += 1;
            log.info('storage:cleanup: удалён осиротевший файл', { path: rel });
          } else {
            hasContent = true;
          }
        } else {
          hasContent = true;
        }
      }
    }
    if (!hasContent) {
      await rm(dir, { recursive: true }).catch(() => undefined);
      return true;
    }
    return false;
  }

  await walk(root);
  return { removedFiles: removed };
}

async function main(): Promise<void> {
  log.info('storage:cleanup: старт', { deletedAfterDays, orphanAfterHours });
  await cleanupDeletedRows();
  const result = await cleanupOrphans();
  log.info('storage:cleanup: готово', result);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error('[storage:cleanup] Ошибка:', error);
    await prisma.$disconnect();
    process.exit(1);
  });
