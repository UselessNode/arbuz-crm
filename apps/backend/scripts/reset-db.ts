// Полная очистка данных БД (только для разработки): все таблицы приложения
// обнуляются, идентификаторы начинаются с 1. Схема и таблица миграций не затрагиваются.
// Запуск из корня: bun db:reset  (затем — bun seed).
import { config } from '../lib/config';
import { prisma } from '../lib/prisma';
import { log } from '../lib/logger';

/** Таблицы приложения в порядке, не требующем учёта связей (CASCADE всё равно сработает). */
const TABLES = [
  'posts_files',
  'pdf_export_jobs',
  'application_reviews',
  'consent_events',
  'consent_files',
  'additional_materials',
  'project_budget',
  'project_plans',
  'team_members',
  'change_logs',
  'applications',
  'documents',
  'files',
  'posts',
  'evaluation_criteria',
  'directions',
  'tenders',
  'consent_documents',
  'file_categories',
  'users',
  'application_statuses',
  'review_statuses',
];

async function main(): Promise<void> {
  if (config.isProduction) {
    throw new Error('[db:reset] Отказ: NODE_ENV=production. Скрипт предназначен только для разработки.');
  }
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${TABLES.join(', ')} RESTART IDENTITY CASCADE`);
  log.info('db:reset: данные удалены, идентификаторы сброшены', { tables: TABLES.length });
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error('[db:reset] Ошибка:', error);
    await prisma.$disconnect();
    process.exit(1);
  });
