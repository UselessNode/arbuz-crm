// Наполнение базовых справочников БД для прода/деплоя.
//
// Отличия от полного `bun seed`:
//   • НЕ создаёт администратора и демо-данные (пользователи, заявки, конкурсы);
//   • только идемпотентные справочники, которые нужны работающему приложению:
//     статусы/вердикты, документы согласий, подсказки разделов, регионы, тексты сайта.
//
// Запуск: bun seed:base  (базовые данные; существует идемпотентно повторно).
// В деплое вызывается после `db push`, чтобы новые таблицы не остались пустыми.
import { prisma } from '../lib/prisma';
import { log } from '../lib/logger';
import { ensureApplicationStatuses, ensureReviewStatuses } from './reference';
import { ensureConsentDocuments } from './consents';
import { ensureSectionHints } from './section-hints';
import { ensureRegions } from './regions';
import { ensureSiteSettings } from './site-settings';

async function main(): Promise<void> {
  await ensureApplicationStatuses();
  await ensureReviewStatuses();
  await ensureConsentDocuments();
  await ensureSectionHints();
  await ensureRegions();
  await ensureSiteSettings();
  log.info('seed:base — базовые справочники готовы');
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error('[seed:base] Ошибка:', error);
    await prisma.$disconnect();
    process.exit(1);
  });
