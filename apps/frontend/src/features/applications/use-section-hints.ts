// Подсказки к разделам формы заявки: загружаются с сервера (админ правит их в
// «Настройка шаблона»), локальные константы — запасной вариант, если API недоступен.
import { useEffect, useState } from 'react';
import { SECTION_HINT_KEYS, sectionHintsApi, type SectionHintKey } from '../../api/section-hints';
import { APPLICATION_SECTION_HINTS } from './section-hints';

export type SectionHintsMap = Record<SectionHintKey, string>;

function fallback(): SectionHintsMap {
  return { ...APPLICATION_SECTION_HINTS };
}

export function useSectionHints(): SectionHintsMap {
  const [hints, setHints] = useState<SectionHintsMap>(fallback);

  useEffect(() => {
    let cancelled = false;
    sectionHintsApi
      .list()
      .then(({ hints: rows }) => {
        if (cancelled) return;
        setHints((prev) => {
          const next = { ...prev };
          for (const key of SECTION_HINT_KEYS) {
            const row = rows.find((item) => item.sectionKey === key);
            if (row?.text) next[key] = row.text;
          }
          return next;
        });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  return hints;
}
