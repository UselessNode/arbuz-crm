// «Настройка шаблона»: skeleton-версия формы заявки, в которой администратор
// редактирует подсказки прямо у соответствующих мест формы. Так видно связь
// «где на форме» ⇄ «какую подсказку правим».
//
// Одна плавающая кнопка «Сохранить изменения» сохраняет все изменённые подсказки.
// Подсказки живут в БД (`application_section_hints`); ссылки на документы
// добавляются в текст markdown-синтаксисом автоматически (см. composeHint).
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Accordion, AccordionItem, Button, MultiSelectFilter, StateMessage, Textarea, useToast } from '../../components/ui';
import { SECTION_HINT_KEYS, type SectionHintKey, sectionHintsApi } from '../../api/section-hints';
import { documentsApi, type PublicDocument } from '../../api/documents';
import { ApiError } from '../../api/client';
import styles from './Applications.module.css';

/** Ссылка на документ в тексте подсказки: `/api/documents/<id>/download` (с любым origin). */
const DOCUMENT_LINK_RE = /[ \t]*\[[^\]]*\]\((?:https?:\/\/[^)\s]*?)?\/api\/documents\/(\d+)\/download\)/g;

/** Отделяет свободный текст подсказки от ссылок на документы (для multi-select). */
function splitHint(text: string): { text: string; docIds: string[] } {
  const docIds: string[] = [];
  const cleaned = text
    .replace(DOCUMENT_LINK_RE, (_match, id: string) => {
      if (!docIds.includes(id)) docIds.push(id);
      return '';
    })
    .trim();
  return { text: cleaned, docIds };
}

/** Собирает итоговый текст подсказки: свободный текст + markdown-ссылки на выбранные документы. */
function composeHint(text: string, docIds: string[], documents: PublicDocument[]): string {
  const links = docIds.map((id) => {
    const document = documents.find((item) => String(item.id) === id);
    const title = document?.title ?? `Документ ${id}`;
    return `[${title}](${window.location.origin}${documentsApi.downloadUrl(Number(id))})`;
  });
  return [text.trim(), ...links].filter(Boolean).join(' ');
}

/** Редактор одной подсказки (рядом с соответствующим полем формы). */
interface HintFieldProps {
  hintKey: SectionHintKey;
  value: string;
  docIds: string[];
  onText: (value: string) => void;
  onDocs: (ids: string[]) => void;
  loadDocumentOptions: (search: string) => Promise<{ value: string; label: string }[]>;
}

function HintField({ hintKey, value, docIds, onText, onDocs, loadDocumentOptions }: HintFieldProps) {
  return (
    <div className={styles.hintField}>
      <span className={styles.hintFieldLabel}>Подсказка</span>
      <Textarea
        value={value}
        rows={2}
        placeholder="Текст подсказки (пусто — подсказки не будет)"
        onChange={(event) => onText(event.target.value)}
        aria-label={`Подсказка ${hintKey}`}
      />
      <MultiSelectFilter
        label="Ссылки на документы"
        placeholder="Найдите документ…"
        value={docIds}
        onChange={onDocs}
        loadOptions={loadDocumentOptions}
      />
    </div>
  );
}

/** Поле формы-скелета (нередактируемое — только для ориентира). */
function SkeletonField({ label, large }: { label: string; large?: boolean }) {
  return (
    <div className={styles.skeletonField}>
      <span className={styles.skeletonLabel}>{label}</span>
      <span className={large ? styles.skeletonBoxLarge : styles.skeletonBox} aria-hidden />
    </div>
  );
}

/** Заголовок-секция формы-скелета. */
function SkeletonSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className={styles.skeletonSection}>
      <h3 className={styles.skeletonSectionTitle}>{title}</h3>
      {children}
    </div>
  );
}

export function TemplateSettingsTab() {
  const toast = useToast();
  const [drafts, setDrafts] = useState<Record<SectionHintKey, string>>(
    () => Object.fromEntries(SECTION_HINT_KEYS.map((key) => [key, ''])) as Record<SectionHintKey, string>,
  );
  const [selectedDocs, setSelectedDocs] = useState<Record<SectionHintKey, string[]>>(
    () => Object.fromEntries(SECTION_HINT_KEYS.map((key) => [key, [] as string[]])) as Record<SectionHintKey, string[]>,
  );
  /** Исходные значения (для определения изменённого и «Сохранить изменения»). */
  const [initial, setInitial] = useState<Map<SectionHintKey, string>>(new Map());
  const [documents, setDocuments] = useState<PublicDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([sectionHintsApi.list(), documentsApi.list()])
      .then(([hintsResponse, documentsResponse]) => {
        if (cancelled) return;
        const nextDrafts = {} as Record<SectionHintKey, string>;
        const nextSelected = {} as Record<SectionHintKey, string[]>;
        const nextInitial = new Map<SectionHintKey, string>();
        for (const key of SECTION_HINT_KEYS) {
          const raw = hintsResponse.hints.find((hint) => hint.sectionKey === key)?.text ?? '';
          const parsed = splitHint(raw);
          nextDrafts[key] = parsed.text;
          nextSelected[key] = parsed.docIds;
          // Сравниваем «собранный» текст — так изменение набора документов тоже видно.
          nextInitial.set(key, composeHint(parsed.text, parsed.docIds, documentsResponse.documents));
        }
        setDrafts(nextDrafts);
        setSelectedDocs(nextSelected);
        setInitial(nextInitial);
        setDocuments(documentsResponse.documents);
      })
      .catch((caught) => {
        if (!cancelled) setError(caught instanceof ApiError ? caught.message : 'Не удалось загрузить данные');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const loadDocumentOptions = useCallback(
    async (search: string) => {
      const needle = search.trim().toLowerCase();
      return documents
        .filter((document) => !needle || document.title.toLowerCase().includes(needle))
        .map((document) => ({ value: String(document.id), label: document.title }));
    },
    [documents],
  );

  /** Итоговый текст текущего черновика для ключа. */
  const composed = useCallback(
    (key: SectionHintKey) => composeHint(drafts[key], selectedDocs[key], documents),
    [drafts, selectedDocs, documents],
  );

  /** Ключи, где текст отличается от исходного. */
  const changedKeys = useMemo(
    () => SECTION_HINT_KEYS.filter((key) => composed(key) !== (initial.get(key) ?? '')),
    [composed, initial],
  );

  const saveAll = async () => {
    if (changedKeys.length === 0) return;
    setSaving(true);
    try {
      for (const key of changedKeys) {
        await sectionHintsApi.update(key, composed(key));
      }
      setInitial((prev) => {
        const next = new Map(prev);
        for (const key of changedKeys) next.set(key, composed(key));
        return next;
      });
      toast.showToast({ message: `Сохранено подсказок: ${changedKeys.length}`, tone: 'success' });
    } catch (caught) {
      toast.showToast({ message: caught instanceof ApiError ? caught.message : 'Не удалось сохранить', tone: 'error' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <StateMessage state="loading" />;
  if (error) return <StateMessage state="error" message={error} />;

  const hint = (key: SectionHintKey) => (
    <HintField
      hintKey={key}
      value={drafts[key]}
      docIds={selectedDocs[key]}
      onText={(value) => setDrafts((prev) => ({ ...prev, [key]: value }))}
      onDocs={(ids) => setSelectedDocs((prev) => ({ ...prev, [key]: ids }))}
      loadDocumentOptions={loadDocumentOptions}
    />
  );

  return (
    <div className={styles.templateEditor}>
      <p className={styles.pageHint}>
        Ниже — структура формы заявки. Рядом с каждым местом формы задаётся его подсказка; пустое
        поле — подсказки на форме не будет. Ссылки на документы (раздел «Документы») добавляются
        кнопкой ниже, либо markdown-синтаксисом <code>[подпись](адрес)</code> прямо в тексте.
      </p>

      <Accordion allowMultiple>
        <AccordionItem itemKey="main" title="Основное" defaultOpen>
          {hint('main')}
          <SkeletonSection title="Поля заявки">
            <SkeletonField label="Название заявки" />
            <SkeletonField label="Идея проекта" large />
            <SkeletonField label="Значимость для команды" large />
            <SkeletonField label="Цель проекта" large />
            <SkeletonField label="Задачи проекта" large />
            <SkeletonField label="Опыт реализации" large />
            <SkeletonField label="Ожидаемые результаты" large />
          </SkeletonSection>
          {/* Подсказки к отдельным полям «Основного». */}
          <div className={styles.hintGrid}>
            {hint('title')}
            {hint('idea')}
            {hint('importance')}
            {hint('goal')}
            {hint('tasks')}
            {hint('experience')}
            {hint('results')}
          </div>
        </AccordionItem>

        <AccordionItem itemKey="team" title="Команда" defaultOpen>
          {hint('team')}
          <SkeletonSection title="Участники команды">
            <SkeletonField label="ФИО, задачи в проекте, контакты, роли, согласие" large />
          </SkeletonSection>
        </AccordionItem>

        <AccordionItem itemKey="plans" title="План мероприятий" defaultOpen>
          {hint('plans')}
          <SkeletonSection title="Мероприятия">
            <SkeletonField label="Задача, мероприятие, описание, период" large />
            <SkeletonField label="Результат (итоги), форма фиксации" large />
          </SkeletonSection>
        </AccordionItem>

        <AccordionItem itemKey="budget" title="Бюджет" defaultOpen>
          {hint('budget')}
          <SkeletonSection title="Статьи бюджета">
            <SkeletonField label="Ресурс, количество, цена, свои/грантовые средства, итог" large />
          </SkeletonSection>
        </AccordionItem>

        <AccordionItem itemKey="materials" title="Материалы" defaultOpen>
          {hint('materials')}
          <SkeletonSection title="Дополнительные материалы">
            <SkeletonField label="Файлы: PDF, DOCX, JPEG, PNG, MP4" />
          </SkeletonSection>
        </AccordionItem>

        <AccordionItem itemKey="reviews" title="Экспертизы" defaultOpen>
          {hint('reviews')}
          <SkeletonSection title="Экспертизы по заявке">
            <SkeletonField label="Эксперты, вердикты и оценки (видны администратору и эксперту)" />
          </SkeletonSection>
        </AccordionItem>
      </Accordion>

      {/* Плавающая панель сохранения — одна на все подсказки. */}
      <div className={styles.floatingSave}>
        <span className={styles.floatingSaveInfo}>
          {changedKeys.length > 0 ? `Изменено подсказок: ${changedKeys.length}` : 'Все изменения сохранены'}
        </span>
        <Button
          icon="check"
          loading={saving}
          disabled={changedKeys.length === 0}
          onClick={() => void saveAll()}
        >
          Сохранить изменения
        </Button>
      </div>
    </div>
  );
}
