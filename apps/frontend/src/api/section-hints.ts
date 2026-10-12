// API настраиваемых подсказок к разделам формы заявки.
import { api } from './client';

/** Ключи разделов — зеркало SECTION_HINT_KEYS на бэкенде. */
export const SECTION_HINT_KEYS = [
  // Составные разделы формы заявки.
  'main',
  'team',
  'plans',
  'budget',
  'materials',
  'reviews',
  // Поля «Основного» (каждому — своя подсказка).
  'title',
  'idea',
  'importance',
  'goal',
  'tasks',
  'experience',
  'results',
] as const;
export type SectionHintKey = (typeof SECTION_HINT_KEYS)[number];

export interface SectionHint {
  sectionKey: SectionHintKey;
  text: string | null;
}

export const sectionHintsApi = {
  list: () => api.get<{ hints: SectionHint[] }>('/application-section-hints'),
  update: (sectionKey: SectionHintKey, text: string) =>
    api.put<{ hint: SectionHint }>(`/application-section-hints/${sectionKey}`, { text }),
};
