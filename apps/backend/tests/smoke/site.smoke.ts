// Смоук: справочник регионов и настраиваемые тексты сайта.
//
// Проверяем: список регионов, единственность региона «по умолчанию», CRUD региона,
// чтение/запись текстов сайта и права доступа (не-админ не может менять).
import { RoleType } from '@arbuz/shared';
import { prisma } from '../../lib/prisma';
import { createRegion, deleteRegion, getDefaultRegion, listRegions, updateRegion } from '../../modules/regions/regions.service';
import {
  SITE_SETTING_KEYS,
  getSiteSetting,
  listSiteSettings,
  upsertSiteSetting,
} from '../../modules/site-settings/site-settings.service';
import { createSmoke } from '../helpers/smoke';
import { requireAdmin } from '../helpers/actors';

const smoke = createSmoke('site (регионы и тексты сайта)');

async function main(): Promise<void> {
  const admin = await requireAdmin();

  // --- Регионы ---
  const regions = await listRegions();
  smoke.ok('регионы созданы', regions.length > 0);
  smoke.ok('есть регион по умолчанию', regions.some((region) => region.isDefault));
  smoke.eq(
    'регион по умолчанию — единственный',
    regions.filter((region) => region.isDefault).length,
    1,
  );

  const defaultRegion = await getDefaultRegion();
  smoke.ok('getDefaultRegion возвращает регион', defaultRegion !== null);

  const name = `[smoke] Регион ${Date.now()}`;
  let createdId: number | null = null;
  try {
    const created = await createRegion({ name, is_default: false });
    createdId = created.id;
    smoke.eq('создание региона: имя сохранено', created.name, name);

    const renamed = await updateRegion(created.id, { name: `${name} (изм.)` });
    smoke.eq('переименование региона', renamed.name, `${name} (изм.)`);

    // Назначаем созданный регион «по умолчанию» — прежний флаг снимается.
    await updateRegion(created.id, { is_default: true });
    const fresh = await listRegions();
    smoke.eq('новый регион по умолчанию — единственный', fresh.filter((region) => region.isDefault).length, 1);
    smoke.ok('по умолчанию назначен созданный регион', fresh.find((region) => region.isDefault)?.id === created.id);

    // Возвращаем прежний регион по умолчанию (не портим dev-данные).
    if (defaultRegion) await updateRegion(defaultRegion.id, { is_default: true });
  } finally {
    if (createdId !== null) await deleteRegion(createdId);
  }

  // --- Тексты сайта ---
  const settings = await listSiteSettings();
  smoke.eq(
    'возвращаются все ключи настроек',
    settings.map((setting) => setting.key),
    [...SITE_SETTING_KEYS],
  );

  const aboutBefore = await getSiteSetting('about');
  try {
    const saved = await upsertSiteSetting(admin, 'about', '# Заголовок\n\nТекст **жирный**');
    smoke.eq('текст настройки сохранён', saved.text, '# Заголовок\n\nТекст **жирный**');
    smoke.ok('HTML настройки отрендерен', saved.html.includes('<strong>'));

    const reloaded = await getSiteSetting('about');
    smoke.eq('текст читается из БД', reloaded.text, '# Заголовок\n\nТекст **жирный**');
  } finally {
    await upsertSiteSetting(admin, 'about', aboutBefore.text);
  }

  await smoke.fails('неизвестный ключ отклоняется', () => getSiteSetting('unknown'), 'INVALID_SETTING_KEY');
  await smoke.fails(
    'не-админ не может менять настройки',
    () => upsertSiteSetting({ id: admin.id, email: admin.email, role: RoleType.expert }, 'about', 'x'),
    'FORBIDDEN',
  );

  await prisma.$disconnect();
  smoke.done();
}

await main();
