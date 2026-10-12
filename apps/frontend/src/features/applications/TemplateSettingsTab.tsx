import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Accordion,
  AccordionItem,
  Button,
  Container,
  Icon,
  Input,
  MultiSelectFilter,
  StateMessage,
  Table,
  Textarea,
  useToast,
} from '../../components/ui';
import type { TableColumn } from '../../components/ui';
import { SECTION_HINT_KEYS, type SectionHintKey, sectionHintsApi } from '../../api/section-hints';
import { documentsApi, type PublicDocument } from '../../api/documents';
import { ApiError } from '../../api/client';
import styles from './Applications.module.css';

const DOCUMENT_LINK_RE = /[ \t]*\[[^\]]*\]\((?:https?:\/\/[^)\s]*?)?\/api\/documents\/(\d+)\/download\)/g;

function splitHint(text: string): { text: string; documentIds: string[] } {
  const documentIds: string[] = [];
  const cleaned = text
    .replace(DOCUMENT_LINK_RE, (_match, id: string) => {
      if (!documentIds.includes(id)) documentIds.push(id);
      return '';
    })
    .trim();
  return { text: cleaned, documentIds };
}

function composeHint(text: string, documentIds: string[], documents: PublicDocument[]): string {
  const links = documentIds.map((id) => {
    const document = documents.find((item) => String(item.id) === id);
    const title = document?.title ?? `Документ ${id}`;
    return `[${title}](${window.location.origin}${documentsApi.downloadUrl(Number(id))})`;
  });
  return [text.trim(), ...links].filter(Boolean).join(' ');
}

/** Поле-ориентир: визуально повторяет Input/Textarea, но только для показа (недоступно). */
function LockedField({ label, multiline = false, placeholder = '' }: { label: string; multiline?: boolean; placeholder?: string }) {
  if (multiline) {
    return (
      <div className={styles.lockedField} aria-hidden>
        <Textarea label={label} value="" placeholder={placeholder} rows={3} disabled onChange={() => undefined} />
      </div>
    );
  }
  return (
    <div className={styles.lockedField} aria-hidden>
      <Input label={label} value="" placeholder={placeholder} disabled onChange={() => undefined} />
    </div>
  );
}

function LockedRow({ children }: { children: ReactNode }) {
  return <div className={styles.grid2}>{children}</div>;
}

function LockedTable({ headers }: { headers: string[] }) {
  type Row = { key: number };
  const columns: TableColumn<Row>[] = headers.map((header, index) => ({
    key: `col-${index}`,
    header,
    render: () => null,
  }));
  return (
    <div className={styles.lockedTable} aria-hidden>
      <Table columns={columns} data={[]} rowKey={(row) => row.key} emptyText=" " />
    </div>
  );
}

interface HintFieldProps {
  /** Человекочитаемое имя места формы — для заголовка и подписи поля. */
  label: string;
  /** Ключ раздела — нужен, чтобы показать особую пометку у секции экспертиз. */
  hintKey: SectionHintKey;
  value: string;
  documentIds: string[];
  onText: (value: string) => void;
  onDocuments: (ids: string[]) => void;
  loadDocumentOptions: (search: string) => Promise<{ value: string; label: string }[]>;
}

function HintField({ label, hintKey, value, documentIds, onText, onDocuments, loadDocumentOptions }: HintFieldProps) {
  // Свёрнутое состояние: кнопка-«ссылка», по нажатию разворачивается в селектор документов.
  // Пока выбраны документы — поле всегда раскрыто; при пустом списке его можно свернуть.
  const [documentsOpen, setDocumentsOpen] = useState(documentIds.length > 0);
  const documentsVisible = documentsOpen || documentIds.length > 0;

  // Секция экспертиз доступна только эксперту — помечаем это для администратора.
  const isExpertSection = hintKey === 'reviews';

  return (
    <div className={styles.hintEditor}>
      <div className={styles.hintEditorHead}>
        <Icon name="info" size={15} className={styles.hintEditorIcon} />
        <span className={styles.hintEditorTitle}>
          Подсказка: {label}
          {isExpertSection && (
            <span className={styles.expertNote}> (Эту секцию видит только эксперт)</span>
          )}
        </span>
      </div>

      <Textarea
        value={value}
        rows={2}
        placeholder="Текст подсказки к этому месту формы. Пусто — подсказки не будет."
        onChange={(event) => onText(event.target.value)}
        aria-label={`Подсказка к полю «${label}»`}
      />

      {/* Ссылки на документы добавляются в конец подсказки — блок идёт под текстом. */}
      {documentsVisible ? (
        <div className={styles.docsBlock}>
          <MultiSelectFilter
            label="Ссылки на документы (добавляются в конец подсказки)"
            placeholder="Начните вводить название…"
            value={documentIds}
            onChange={onDocuments}
            loadOptions={loadDocumentOptions}
          />
          {documentIds.length === 0 ? (
            <div>
              <Button size="sm" variant="ghost" icon="close" onClick={() => setDocumentsOpen(false)}>
                Свернуть
              </Button>
            </div>
          ) : null}
        </div>
      ) : (
        <div className={styles.docsAddRow}>
          <Button size="sm" variant="secondary" icon="chain" onClick={() => setDocumentsOpen(true)}>
            Добавить ссылку на документ
          </Button>
        </div>
      )}
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
  const [initial, setInitial] = useState<Map<SectionHintKey, string>>(new Map());
  const [documents, setDocuments] = useState<PublicDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | SectionHintKey>('all');

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
          nextSelected[key] = parsed.documentIds;
          nextInitial.set(key, composeHint(parsed.text, parsed.documentIds, documentsResponse.documents));
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

  const composed = useCallback(
    (key: SectionHintKey) => composeHint(drafts[key], selectedDocs[key], documents),
    [drafts, selectedDocs, documents],
  );

  const changedKeys = useMemo(
    () => SECTION_HINT_KEYS.filter((key) => composed(key) !== (initial.get(key) ?? '')),
    [composed, initial],
  );

  // Откат всех несохранённых правок к последнему сохранённому состоянию.
  const resetAll = () => {
    const nextDrafts = {} as Record<SectionHintKey, string>;
    const nextSelected = {} as Record<SectionHintKey, string[]>;
    for (const key of SECTION_HINT_KEYS) {
      const saved = initial.get(key) ?? '';
      const parsed = splitHint(saved);
      nextDrafts[key] = parsed.text;
      nextSelected[key] = parsed.documentIds;
    }
    setDrafts(nextDrafts);
    setSelectedDocs(nextSelected);
  };

  const saveAll = async () => {
    if (changedKeys.length === 0) return;
    setSaving(true);
    try {
      for (const key of changedKeys) await sectionHintsApi.update(key, composed(key));
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

  const fieldLabels: Partial<Record<SectionHintKey, string>> = {
    title: 'Название заявки',
    idea: 'Идея проекта',
    importance: 'Значимость для команды',
    goal: 'Цель проекта',
    tasks: 'Задачи проекта',
    experience: 'Опыт реализации',
    results: 'Ожидаемые результаты',
  };

  const hint = (key: SectionHintKey) => {
    const label = fieldLabels[key] ?? labelOf(key);
    return (
      <HintField
        hintKey={key}
        label={label}
        value={drafts[key]}
        documentIds={selectedDocs[key]}
        onText={(value) => setDrafts((prev) => ({ ...prev, [key]: value }))}
        onDocuments={(ids) => setSelectedDocs((prev) => ({ ...prev, [key]: ids }))}
        loadDocumentOptions={loadDocumentOptions}
      />
    );
  };

  const tabs: ReadonlyArray<{ key: 'all' | SectionHintKey; label: string }> = [
    { key: 'all', label: 'ВСЕ' },
    { key: 'main', label: 'Основное' },
    { key: 'team', label: 'Команда' },
    { key: 'plans', label: 'План мероприятий' },
    { key: 'budget', label: 'Бюджет' },
    { key: 'materials', label: 'Материалы' },
    { key: 'reviews', label: 'Экспертизы' },
  ];

  const visibleKeys: SectionHintKey[] =
    activeTab === 'all' ? ['main', 'team', 'plans', 'budget', 'materials', 'reviews'] : [activeTab];
  const labelOf = (key: SectionHintKey) => tabs.find((item) => item.key === key)?.label ?? '';

  return (
    <div className={styles.templateEditor}>
      <div className={styles.tabs} role="tablist" aria-label="Разделы заявки">
        {tabs.map((item) => (
          <Button
            key={item.key}
            size="sm"
            variant={activeTab === item.key ? 'primary' : 'secondary'}
            role="tab"
            aria-selected={activeTab === item.key}
            onClick={() => setActiveTab(item.key)}
          >
            {item.label}
          </Button>
        ))}
      </div>

      <Container title="Форма заявки (шаблон)">
        <p className={styles.pageHint}>
          Здесь правится текст подсказок к разделам и полям формы заявки. Приглушённые поля показывают,
          в каком месте формы появится подсказка; пустой текст — подсказки не будет. Ссылки на документы
          добавляются к тексту подсказки.
        </p>

        <Accordion allowMultiple>
          {visibleKeys.map((key) => (
            <AccordionItem key={key} itemKey={key} title={labelOf(key)} defaultOpen>
              {key === 'main' ? (
                <div className={styles.sectionBody}>
                  {hint('main')}
                  {hint('title')}
                  <LockedField label="Название заявки" />
                  <LockedRow>
                    <LockedField label="Конкурс" placeholder="Не выбрано" />
                    <LockedField label="Направление" placeholder="Не выбрано" />
                  </LockedRow>
                  {hint('idea')}
                  <LockedField label="Идея проекта" multiline />
                  {hint('importance')}
                  <LockedField label="Значимость для команды" multiline />
                  {hint('goal')}
                  <LockedField label="Цель проекта" multiline />
                  {hint('tasks')}
                  <LockedField label="Задачи проекта" multiline />
                  {hint('experience')}
                  <LockedField label="Опыт реализации" multiline />
                  {hint('results')}
                  <LockedField label="Ожидаемые результаты" multiline />
                </div>
              ) : null}

              {key === 'team' ? (
                <div className={styles.sectionBody}>
                  {hint('team')}
                  <LockedTable headers={['ФИО', 'Возраст', 'Задачи', 'Роли', 'Согласие']} />
                </div>
              ) : null}

              {key === 'plans' ? (
                <div className={styles.sectionBody}>
                  {hint('plans')}
                  <LockedTable headers={['Мероприятие', 'Задача', 'Начало', 'Окончание', 'Результат (итоги)', 'Форма фиксации']} />
                </div>
              ) : null}

              {key === 'budget' ? (
                <div className={styles.sectionBody}>
                  {hint('budget')}
                  <LockedTable
                    headers={[
                      'Требуемый ресурс',
                      'Кол-во',
                      'Цена за ед., ₽',
                      'Собственные средства, ₽',
                      'Средства гранта, ₽',
                      'Итого, ₽',
                    ]}
                  />
                </div>
              ) : null}

              {key === 'materials' ? (
                <div className={styles.sectionBody}>
                  {hint('materials')}
                  <LockedTable headers={['Файл', 'Тип', 'Размер', 'Комментарий', 'Загружен']} />
                </div>
              ) : null}

              {key === 'reviews' ? (
                <div className={styles.sectionBody}>
                  {hint('reviews')}
                  <LockedTable headers={['Эксперт', 'Вердикт', 'Балл', 'Комментарий']} />
                </div>
              ) : null}
            </AccordionItem>
          ))}
        </Accordion>
      </Container>

      <div className={styles.floatingSave}>
        <span className={styles.floatingSaveInfo}>
          {changedKeys.length > 0
            ? `Изменено подсказок: ${changedKeys.length}`
            : 'Все изменения сохранены'}
        </span>
        {changedKeys.length > 0 ? (
          <Button variant="secondary" icon="close" disabled={saving} onClick={resetAll}>
            Отменить изменения
          </Button>
        ) : null}
        <Button icon="check" loading={saving} disabled={changedKeys.length === 0} onClick={() => void saveAll()}>
          Сохранить изменения
        </Button>
      </div>
    </div>
  );
}
