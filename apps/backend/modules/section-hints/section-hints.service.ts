// Бизнес-логика настраиваемых подсказок к разделам формы заявки.
import { prisma } from '../../lib/prisma';
import { httpError } from '../../lib/http';

/** Ключи разделов формы заявки — совпадают с SECTION_HINT_KEYS во фронтенде. */
export const SECTION_HINT_KEYS = ['main', 'team', 'plans', 'budget', 'materials', 'reviews'] as const;
export type SectionHintKey = (typeof SECTION_HINT_KEYS)[number];

export interface SectionHint {
  sectionKey: SectionHintKey;
  text: string | null;
}

function isSectionKey(value: string): value is SectionHintKey {
  return (SECTION_HINT_KEYS as readonly string[]).includes(value);
}

/** Все известные разделы — с сохранённым текстом или `null`, если он не задан. */
export async function listSectionHints(): Promise<SectionHint[]> {
  const rows = await prisma.application_section_hints.findMany();
  const byKey = new Map(rows.map((row) => [row.section_key, row.text]));
  return SECTION_HINT_KEYS.map((sectionKey) => ({ sectionKey, text: byKey.get(sectionKey) ?? null }));
}

/** Сохраняет (создаёт/обновляет) текст подсказки раздела. Пустая строка сохраняется как `null`. */
export async function upsertSectionHint(sectionKey: string, text: unknown): Promise<SectionHint> {
  if (!isSectionKey(sectionKey)) {
    throw httpError(400, 'Неизвестный раздел подсказки', 'INVALID_SECTION');
  }
  const value = text === undefined || text === null ? null : String(text);
  const trimmed = value === null || value.trim() === '' ? null : value;
  const row = await prisma.application_section_hints.upsert({
    where: { section_key: sectionKey },
    create: { section_key: sectionKey, text: trimmed },
    update: { text: trimmed },
  });
  return { sectionKey, text: row.text };
}
