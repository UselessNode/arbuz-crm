// Смоук: подсказки к разделам формы заявки (настраиваются администратором).
//
// Проверяем, что список возвращает все известные разделы, сохранение/чтение работает,
// пустая строка превращается в `null`, а неизвестный раздел отклоняется.
import { createSmoke } from '../helpers/smoke';
import { SECTION_HINT_KEYS, listSectionHints, upsertSectionHint } from '../../modules/section-hints/section-hints.service';

const smoke = createSmoke('section-hints (подсказки разделов формы)');

async function main(): Promise<void> {
  const initial = await listSectionHints();
  smoke.eq(
    'возвращаются все известные разделы',
    initial.map((hint) => hint.sectionKey),
    [...SECTION_HINT_KEYS],
  );

  const key = 'materials';
  const before = initial.find((hint) => hint.sectionKey === key)?.text ?? null;
  try {
    const saved = await upsertSectionHint(key, '[smoke] текст подсказки');
    smoke.eq('сохранение возвращает текст', saved.text, '[smoke] текст подсказки');

    const reloaded = await listSectionHints();
    smoke.eq('текст читается из БД', reloaded.find((hint) => hint.sectionKey === key)?.text, '[smoke] текст подсказки');

    const cleared = await upsertSectionHint(key, '   ');
    smoke.eq('пустая строка сохраняется как null', cleared.text, null);
  } finally {
    await upsertSectionHint(key, before ?? '');
  }

  await smoke.fails('неизвестный раздел отклоняется', () => upsertSectionHint('unknown', 'x'), 'INVALID_SECTION');

  smoke.done();
}

main();
