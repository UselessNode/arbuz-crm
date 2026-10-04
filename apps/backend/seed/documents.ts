// Публичные документы seed: файл-заглушка на диске + записи files/documents.
// Нужны, чтобы раздел «Документы» на главной и в админке был непустым.
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { prisma } from '../lib/prisma';
import { log } from '../lib/logger';
import { config } from '../lib/config';
import type { SeedDocument } from './data';

/** Подкаталог документов внутри каталога загрузок. */
const DOCUMENTS_FOLDER = 'documents';

/** Содержимое-заглушка (текст в файле с расширением .pdf — только для dev-данных). */
function placeholderContent(title: string): string {
  return `%PDF-1.4\n% Тестовый документ (seed). Содержимое-заглушка для разработки.\n${title}\n%%EOF\n`;
}

/** Создаёт документ, если его ещё нет (идемпотентно по заголовку). */
export async function ensureDocument(document: SeedDocument, sortOrder: number): Promise<void> {
  const existing = await prisma.documents.findFirst({
    where: { title: document.title, deleted_at: null },
    select: { id: true },
  });
  if (existing) return;

  // Физический файл кладём в UPLOAD_DIR, в БД — путь с namespace-префиксом `uploads/`.
  const relativePath = `uploads/${DOCUMENTS_FOLDER}/${document.fileName}`;
  const physicalPath = path.resolve(config.uploads.dir, DOCUMENTS_FOLDER, document.fileName);
  await mkdir(path.dirname(physicalPath), { recursive: true });
  await writeFile(physicalPath, placeholderContent(document.title), 'utf8');

  await prisma.$transaction(async (tx) => {
    const file = await tx.files.create({
      data: { name: document.fileName, file_type: 'pdf', path: relativePath },
      select: { id: true },
    });
    await tx.documents.create({
      data: {
        title: document.title,
        description: document.description,
        file_id: file.id,
        sort_order: sortOrder,
        is_published: true,
      },
    });
  });
  log.info('seed: добавлен документ', { title: document.title });
}
