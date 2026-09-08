// Хранилище файлов на диске. В БД хранится относительный путь вида
// uploads/<owner_id>-<application_id>-<время>/<uuid>.<ext>
// (согласия — uploads/<...>/consents/<uuid>.<ext>).
import { createReadStream } from 'node:fs';
import { mkdir, rename, stat, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { ReadStream } from 'node:fs';
import { config } from '../../lib/config';
import { httpError } from '../../lib/http';

export const UPLOADS_PREFIX = 'uploads';

/** Относительный путь из БД -> физический путь внутри каталога загрузок (с защитой от выхода). */
export function toPhysical(relativePath: string): string {
  const normalized = relativePath.split('/').filter(Boolean).join(path.sep);
  const physical = path.resolve(config.uploads.dir, normalized);
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
