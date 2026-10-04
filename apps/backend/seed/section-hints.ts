// Значения подсказок к разделам формы заявки по умолчанию.
// Идемпотентно: существующие записи не перезаписываются (админ мог их изменить).
import { prisma } from '../lib/prisma';
import { log } from '../lib/logger';
import { SECTION_HINT_KEYS, type SectionHintKey } from '../modules/section-hints/section-hints.service';

/**
 * Тексты по умолчанию. Ссылки на образцы согласий ПДн задаются markdown-синтаксисом
 * `[подпись](url)`; URL отдаёт актуальную версию файла (см. modules/consents).
 */
export const SECTION_HINT_DEFAULTS: Record<SectionHintKey, string> = {
  main: 'Опишите суть проекта: какую проблему он решает, почему это важно для команды и сообщества, какова цель, задачи и ожидаемые результаты.',
  team: 'Перечислите всех, кто будет работать над проектом. Отметьте координатора и ответственного за форум. Для каждого участника обязателен файл согласия на обработку персональных данных — без него заявку нельзя отправить. Образцы согласия: [до 14 лет](/api/consents/templates/minor/download), [с 14 лет](/api/consents/templates/adult/download).',
  plans: 'Опишите мероприятия проекта с датами: что и когда будет сделано, какой результат ожидается в каждом мероприятии. Дата окончания не может быть раньше даты начала.',
  budget: 'Укажите статьи расходов: требуемый ресурс, количество и цену за единицу. Свои и привлечённые средства складываются со средствами гранта — итог по статье должен покрывать её расчётную стоимость (количество × цена).',
  materials: 'Приложите дополнительные материалы: презентации, сметы, письма поддержки, фото и видео. Допустимые форматы: PDF, DOCX, JPEG, PNG, MP4.',
  reviews: 'Экспертизы по заявке: назначение экспертов и их вердикты. Вердикт эксперта — рекомендация, финальный статус заявки ставит администратор.',
};

/** Создаёт подсказки для отсутствующих разделов, не трогая уже сохранённые. */
export async function ensureSectionHints(): Promise<void> {
  const existing = await prisma.application_section_hints.findMany({ select: { section_key: true } });
  const present = new Set(existing.map((row) => row.section_key));
  const missing = SECTION_HINT_KEYS.filter((key) => !present.has(key));
  if (missing.length === 0) return;
  await prisma.application_section_hints.createMany({
    data: missing.map((section_key) => ({ section_key, text: SECTION_HINT_DEFAULTS[section_key] })),
  });
  log.info('seed: созданы подсказки разделов формы заявки', { created: missing.length });
}
