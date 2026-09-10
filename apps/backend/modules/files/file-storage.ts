// Хранилище файлов на диске. В БД хранится относительный путь с логическим
// namespace `uploads/`: uploads/<owner_id>-<application_id>-<время>/<uuid>.<ext>
// (согласия — uploads/<...>/consents/<uuid>.<ext>).
// Физический корень — config.uploads.dir (UPLOAD_DIR), поэтому namespace-префикс
// при вычислении физического пути отбрасывается.
import { createReadStream } from 'node:fs';
import { mkdir, stat, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { ReadStream } from 'node:fs';
import { config } from '../../lib/config';
import { httpError } from '../../lib/http';

export const UPLOADS_PREFIX = 'uploads';

/**
 * Путь из БД -> путь относительно каталога загрузок (без namespace-префикса `uploads/`).
 * Используется и хранилищем, и обслуживанием (cleanup) — единая конвенция путей.
 */
export function toRelativePath(relativePath: string): string {
  const segments = relativePath.split('/').filter(Boolean);
  if (segments[0] === UPLOADS_PREFIX) segments.shift();
  return segments.join(path.sep);
}

/** Относительный путь из БД -> физический путь внутри каталога загрузок (с защитой от выхода). */
export function toPhysical(relativePath: string): string {
  const physical = path.resolve(config.uploads.dir, toRelativePath(relativePath));
  const root = path.resolve(config.uploads.dir);
  if (physical !== root && !physical.startsWith(root + path.sep)) {
    throw httpError(400, 'Некорректный путь файла', 'INVALID_FILE_PATH');
  }
  return physical;
}

/**
 * Сохраняет содержимое в каталоге приложения. Возвращает относительный путь для БД.
 * @param folderRel каталог приложения: "<ownerId>-<appId>-<время>" (без "uploads/")
 * @param subFolder подкаталог (например "consents") или undefined
 */
export async function storeUpload(
  buffer: Buffer,
  folderRel: string,
  ext: string,
  subFolder?: string,
): Promise<string> {
  const relativePath =
    `${UPLOADS_PREFIX}/${folderRel}${subFolder ? `/${subFolder}` : ''}/${randomUUID()}.${ext}`;
  const physical = toPhysical(relativePath);
  await mkdir(path.dirname(physical), { recursive: true });
  await writeFile(physical, buffer);
  return relativePath;
}

/** Возвращает поток и размер файла по относительному пути. */
export async function openStored(relativePath: string): Promise<{ stream: ReadStream; size: number }> {
  const physical = toPhysical(relativePath);
  const info = await stat(physical).catch(() => null);
  if (!info || !info.isFile()) {
    throw httpError(404, 'Файл отсутствует на сервере', 'FILE_MISSING');
  }
  return { stream: createReadStream(physical), size: info.size };
}

/** Удаляет физический файл; отсутствующий файл не считается ошибкой. */
export async function removeStored(relativePath: string): Promise<void> {
  const physical = toPhysical(relativePath);
  await unlink(physical).catch(() => undefined);
}
