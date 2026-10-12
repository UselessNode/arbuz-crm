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

function composeHint(text: string, docIds: string[], documents: PublicDocument[]): string {
  const links = docIds.map((id) => {
    const document = documents.find((item) => String(item.id) === id);
    const title = document?.title ?? `Документ ${id}`;
    return `[${title}](${window.location.origin}${documentsApi.downloadUrl(Number(id))})`;
  });
  return [text.trim(), ...links].filter(Boolean).join(' ');
}

/** Поле-ориентир: визуально повторяет Input/Textarea, но только для показа (disabled). */
function LockedField({ label, multiline = false, placeholder = '' }: { label: string; multiline?: boolean; placeholder?: string }) {
  const wrapper = [styles.lockedField].filter(Boolean).join(' ');
  if (multiline) {
    return (
      <div className={wrapper} aria-hidden>
        <Textarea label={label} value="" placeholder={placeholder} rows={3} disabled onChange={() => undefined} />
      </div>
    );
  }
  return (
    <div className={wrapper} aria-hidden>
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
  hintKey: SectionHintKey;
  value: string;
  docIds: string[];
  onText: (value: string) => void;
  onDocs: (ids: string[]) => void;
  loadDocumentOptions: (search: string) => Promise<{ value: string; label: string }[]>;
}

function HintField({ hintKey, value, docIds, onText, onDocs, loadDocumentOptions }: HintFieldProps) {
  // Свёрнутое состояние: только кнопка-«плюс», как у свёрнутого поиска (SearchField).
  // По нажатию кнопка «разворачивается» в поле с автодополнением и чипами.
  const [docsOpen, setDocsOpen] = useState(docIds.length > 0);

  return (
    <div className={styles.hintEditor}>
      <div className={styles.hintEditorHead}>
        <Icon name="info" size={15} className={styles.hintEditorIcon} />
        <span className={styles.hintEditorTitle}>Подсказка на форме</span>
      </div>

      <Textarea
        value={value}
        rows={2}
        placeholder="Текст подсказки. Если оставить пустым, то подсказка не будет отображаться)"
        onChange={(event) => onText(event.target.value)}
        aria-label={`Подсказка ${hintKey}`}
      />

      {/* Ссылки на документы добавляются в конец подсказки — блок идёт под текстом. */}
      {docsOpen ? (
        <MultiSelectFilter
          label="Ссылки на документы (добавляются в конец подсказки)"
          placeholder="Начните вводить название…"
          value={docIds}
          onChange={onDocs}
          loadOptions={loadDocumentOptions}
        />
      ) : (
        <div className={styles.docsAddRow}>
          <Button
            size="sm"
            variant="secondary"
            icon="plus"
            aria-label="Добавить ссылку на документ"
            title="Добавить ссылку на документ"
            onClick={() => setDocsOpen(true)}
          />
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
          nextSelected[key] = parsed.docIds;
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

  const composed = useCallback(
    (key: SectionHintKey) => composeHint(drafts[key], selectedDocs[key], documents),
    [drafts, selectedDocs, documents],
  );

  const changedKeys = useMemo(
    () => SECTION_HINT_KEYS.filter((key) => composed(key) !== (initial.get(key) ?? '')),
    [composed, initial],
  );

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
          Это копия формы заявки: заблокированные поля показывают, где появится подсказка; синие
          блоки — редактируемые подсказки. Пустой текст — подсказки на форме не будет.
        </p>

        <Accordion allowMultiple>
          {visibleKeys.map((key) => (
            <AccordionItem key={key} itemKey={key} title={labelOf(key)} defaultOpen>
              {key === 'main' ? (
                <>
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
                </>
              ) : null}

              {key === 'team' ? (
                <>
                  {hint('team')}
                  <LockedTable headers={['ФИО', 'Возраст', 'Задачи', 'Роли', 'Согласие']} />
                </>
              ) : null}

              {key === 'plans' ? (
                <>
                  {hint('plans')}
                  <LockedTable headers={['Мероприятие', 'Задача', 'Начало', 'Окончание', 'Результат (итоги)', 'Форма фиксации']} />
                </>
              ) : null}

              {key === 'budget' ? (
                <>
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
                </>
              ) : null}

              {key === 'materials' ? (
                <>
                  {hint('materials')}
                  <LockedTable headers={['Файл', 'Тип', 'Размер', 'Комментарий', 'Загружен']} />
                </>
              ) : null}

              {key === 'reviews' ? (
                <>
                  {hint('reviews')}
                  <LockedTable headers={['Эксперт', 'Вердикт', 'Балл', 'Комментарий']} />
                </>
              ) : null}
            </AccordionItem>
          ))}
        </Accordion>
      </Container>

      <div className={styles.floatingSave}>
        <span className={styles.floatingSaveInfo}>
          {changedKeys.length > 0 ? `Изменено подсказок: ${changedKeys.length}` : 'Все изменения сохранены'}
        </span>
        <Button icon="check" loading={saving} disabled={changedKeys.length === 0} onClick={() => void saveAll()}>
          Сохранить изменения
        </Button>
      </div>
    </div>
  );
}
