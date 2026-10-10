// Разовая чистка прод-базы от тестовых/демо данных.
//
// Сохраняет: администраторов (`role = admin`), регионы и системные справочники
// (статусы заявок и вердикты, тексты согласий, подсказки разделов, тексты сайта,
// категории файлов). Всё остальное — тестовое.
// Удаляет: всех не-админов и связанные данные (заявки, экспертизы, уведомления,
// журнал согласий — каскадом), публикации, документы, конкурсы/направления/критерии,
// задания PDF, журнал изменений и все файлы на диске.
//
// По умолчанию — СУХОЙ ПРОГОН (печатает, что будет удалено). Реальное удаление — флаг `--apply`
// (или переменная `PURGE_APPLY=1`). Запуск на сервере:
//   docker compose run --rm -w /app arbuz-backend bun scripts/purge-demo.ts
//   docker compose run --rm -w /app arbuz-backend bun scripts/purge-demo.ts --apply
import { readdir, unlink, rm } from 'node:fs/promises';
import path from 'node:path';
import { RoleType } from '@arbuz/shared';
import { config } from '../lib/config';
import { prisma } from '../lib/prisma';
import { log } from '../lib/logger';

const apply = process.argv.includes('--apply') || process.env.PURGE_APPLY === '1';
const mode = apply ? 'БОЕВОЙ (удаление)' : 'СУХОЙ ПРОГОН (только отчёт)';
log.info(`purge-demo: ${mode}`, { apply });

/** Пошаговый план: подпись, функция подсчёта и функция удаления. */
interface Step {
  label: string;
  count: () => Promise<number>;
  remove: () => Promise<number>;
}

const steps: Step[] = [
  {
    label: 'Задания PDF (pdf_export_jobs)',
    count: () => prisma.pdf_export_jobs.count(),
    remove: async () => (await prisma.pdf_export_jobs.deleteMany({})).count,
  },
  {
    label: 'Вердикты экспертиз (application_reviews)',
    count: () => prisma.application_reviews.count(),
    remove: async () => (await prisma.application_reviews.deleteMany({})).count,
  },
  {
    label: 'Связи постов и вложений (posts_files)',
    count: () => prisma.posts_files.count(),
    remove: async () => (await prisma.posts_files.deleteMany({})).count,
  },
  {
    label: 'Материалы заявок (additional_materials)',
    count: () => prisma.additional_materials.count(),
    remove: async () => (await prisma.additional_materials.deleteMany({})).count,
  },
  {
    label: 'Согласия команды (consent_files)',
    count: () => prisma.consent_files.count(),
    remove: async () => (await prisma.consent_files.deleteMany({})).count,
  },
  {
    label: 'Заявки (applications — с командой, планами, бюджетом)',
    count: () => prisma.applications.count(),
    remove: async () => (await prisma.applications.deleteMany({})).count,
  },
  {
    label: 'Публикации (posts)',
    count: () => prisma.posts.count(),
    remove: async () => (await prisma.posts.deleteMany({})).count,
  },
  {
    label: 'Публичные документы (documents)',
    count: () => prisma.documents.count(),
    remove: async () => (await prisma.documents.deleteMany({})).count,
  },
  {
    label: 'Файлы (files)',
    count: () => prisma.files.count(),
    remove: async () => (await prisma.files.deleteMany({})).count,
  },
  {
    label: 'Уведомления (notifications)',
    count: () => prisma.notifications.count(),
    remove: async () => (await prisma.notifications.deleteMany({})).count,
  },
  {
    label: 'Журнал изменений (change_logs)',
    count: () => prisma.change_logs.count(),
    remove: async () => (await prisma.change_logs.deleteMany({})).count,
  },
  {
    label: 'Пользователи без роли «администратор» (users; каскадом — их consent_events)',
    count: () => prisma.users.count({ where: { role: { not: RoleType.admin } } }),
    remove: async () => (await prisma.users.deleteMany({ where: { role: { not: RoleType.admin } } })).count,
  },
  {
    label: 'Направления конкурсов (directions)',
    count: () => prisma.directions.count(),
    remove: async () => (await prisma.directions.deleteMany({})).count,
  },
  {
    label: 'Критерии оценки (evaluation_criteria)',
    count: () => prisma.evaluation_criteria.count(),
    remove: async () => (await prisma.evaluation_criteria.deleteMany({})).count,
  },
  {
    label: 'Конкурсы (tenders)',
    count: () => prisma.tenders.count(),
    remove: async () => (await prisma.tenders.deleteMany({})).count,
  },
];

/** Считает и (при `apply`) удаляет файлы под `UPLOAD_DIR` — после чистки БД они осиротевшие. */
async function purgeUploads(): Promise<number> {
  const root = path.resolve(config.uploads.dir);
  let count = 0;

  async function walk(dir: string): Promise<void> {
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(full);
      } else if (entry.isFile()) {
        count += 1;
        if (apply) await unlink(full).catch(() => undefined);
      }
    }
  }

  await walk(root);
  if (apply) {
    // Подчищаем опустевшие подкаталоги.
    for (const entry of await readdir(root, { withFileTypes: true }).catch(() => [])) {
      if (entry.isDirectory()) await rm(path.join(root, entry.name), { recursive: true, force: true }).catch(() => undefined);
    }
  }
  return count;
}

async function main(): Promise<void> {
  const keptAdmins = await prisma.users.count({ where: { role: RoleType.admin } });
  const keptRegions = await prisma.regions.count();
  log.info(`purge-demo: сохраняются администраторы: ${keptAdmins}, регионы: ${keptRegions}`);

  let total = 0;
  for (const step of steps) {
    const n = apply ? await step.remove() : await step.count();
    total += n;
    console.log(`  ${apply ? '✗ удалено' : '• к удалению'}: ${n}\t${step.label}`);
  }

  const files = await purgeUploads();
  console.log(`  ${apply ? '✗ удалено' : '• к удалению'}: ${files}\tфайлы на диске (uploads/)`);

  console.log(`\npurge-demo: ${mode}. Всего записей: ${total}, файлов: ${files}.`);
  if (!apply) {
    console.log('Это сухой прогон — ничего не изменено. Для реального удаления добавьте --apply.');
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error('[purge-demo] Ошибка:', error);
    await prisma.$disconnect();
    process.exit(1);
  });
