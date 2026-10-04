// Админский раздел «Документы и согласия»: два раздела на одной странице.
//  • «Документы» — публичные файлы (главная страница): загрузка, порядок, публикация.
//  • «Соглашения» — версии текстов (ПС и ПДн): история и публикация новой редакции.
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  Badge,
  Button,
  Checkbox,
  ConfirmDialog,
  Container,
  DataView,
  DragDrop,
  Icon,
  Input,
  Modal,
  RowActions,
  StateMessage,
  Textarea,
  useDataViewState,
  useTableReorder,
  useToast,
} from '../../components/ui';
import type { DateRangeValue, FilterSpec, TableColumn } from '../../components/ui';
import { documentsApi, type ConsentTemplateKind, type DocumentPayload, type PublicDocument } from '../../api/documents';
import { consentsApi, ConsentDocumentType, type ConsentDocument } from '../../api/consents';
import { ApiError } from '../../api/client';
import { formatDateTime } from '../../lib/format';
import { sortRows } from '../../lib/sort-rows';
import styles from './DocumentsPage.module.css';

type Tab = 'documents' | 'consents';

const CONSENT_LABELS: Record<ConsentDocumentType, string> = {
  [ConsentDocumentType.terms]: 'Пользовательское соглашение',
  [ConsentDocumentType.personal_data_consent]: 'Согласие на обработку персональных данных',
};

export function DocumentsPage() {
  const [tab, setTab] = useState<Tab>('documents');

  return (
    <div>
      <h1 className={styles.pageTitle}>Документы и согласия</h1>
      <div className={styles.tabs} role="tablist" aria-label="Разделы">
        <Button size="sm" variant={tab === 'documents' ? 'primary' : 'secondary'} onClick={() => setTab('documents')}>
          Документы
        </Button>
        <Button size="sm" variant={tab === 'consents' ? 'primary' : 'secondary'} onClick={() => setTab('consents')}>
          Соглашения
        </Button>
      </div>

      {tab === 'documents' ? <DocumentsTab /> : <ConsentsTab />}
    </div>
  );
}

// --- Раздел «Документы» ---

/**
 * Новый порядок списка после перестановки (draggedId → позиция targetId).
 * Порядок строк в массиве — источник истины для отображения, поэтому его надо менять,
 * а не только обновлять значения `sort_order`.
 */
function reorderDocuments(
  list: PublicDocument[],
  draggedId: number,
  targetId: number,
): PublicDocument[] | null {
  const from = list.findIndex((document) => document.id === draggedId);
  const to = list.findIndex((document) => document.id === targetId);
  if (from === -1 || to === -1 || from === to) return null;
  const next = [...list];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

function DocumentsTab() {
  const toast = useToast();
  const [documents, setDocuments] = useState<PublicDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<PublicDocument | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<PublicDocument | null>(null);
  const [deleteSaving, setDeleteSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await documentsApi.list();
      setDocuments(response.documents);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Не удалось загрузить документы');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const specs = useMemo<FilterSpec[]>(
    () => [
      {
        kind: 'multi-select',
        field: 'name',
        label: 'По названию',
        placeholder: 'Название документа…',
        loadOptions: async (search) => {
          const needle = search.trim().toLowerCase();
          return documents
            .filter((document) => !needle || document.title.toLowerCase().includes(needle))
            .map((document) => ({ value: String(document.id), label: document.title }));
        },
      },
      {
        kind: 'checkbox-group',
        field: 'status',
        label: 'Статус документа',
        options: [
          { value: 'published', label: 'Опубликован' },
          { value: 'hidden', label: 'Скрыт' },
        ],
      },
      { kind: 'date-range', field: 'created', label: 'Дата создания', presets: true },
      { kind: 'date-range', field: 'updated', label: 'Дата изменения', presets: true },
    ],
    [documents],
  );

  const state = useDataViewState({ specs, defaultPageSize: 50 });
  const { query } = state;

  // Документов немного — фильтруем на клиенте по состоянию DataView.
  const filtered = useMemo(() => {
    const needle = query.search.trim().toLowerCase();
    const names = (query.filters.name as string[] | undefined) ?? [];
    const statuses = (query.filters.status as string[] | undefined) ?? [];
    const created = query.filters.created as DateRangeValue | undefined;
    const updated = query.filters.updated as DateRangeValue | undefined;
    return documents.filter((document) => {
      if (needle && !document.title.toLowerCase().includes(needle)) return false;
      if (names.length && !names.includes(String(document.id))) return false;
      if (statuses.length && !statuses.includes(document.isPublished ? 'published' : 'hidden')) return false;
      const createdDay = document.createdAt.slice(0, 10);
      if (created?.from && createdDay < created.from) return false;
      if (created?.to && createdDay > created.to) return false;
      const updatedDay = document.updatedAt.slice(0, 10);
      if (updated?.from && updatedDay < updated.from) return false;
      if (updated?.to && updatedDay > updated.to) return false;
      return true;
    });
  }, [documents, query]);

  const sorted = useMemo(
    () =>
      sortRows(filtered, query.sort, (document, field) => {
        switch (field) {
          case 'title':
            return document.title.toLowerCase();
          case 'published':
            return document.isPublished ? 1 : 0;
          case 'created_at':
            return document.createdAt;
          case 'updated_at':
            return document.updatedAt;
          default:
            return document.id;
        }
      }),
    [filtered, query.sort],
  );

  const confirmDelete = async () => {
    if (!deleting) return;
    setDeleteSaving(true);
    try {
      await documentsApi.remove(deleting.id);
      setDeleting(null);
      toast.showToast({ message: 'Документ удалён', tone: 'success' });
      await load();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Не удалось удалить документ');
    } finally {
      setDeleteSaving(false);
    }
  };

  // Ручной порядок доступен только для полного списка (без фильтров и сортировки).
  const reorderDisabled = state.hasActiveFilters || Boolean(query.sort);

  /** Перестановка (draggedId → позиция targetId): локально меняем порядок + PATCH изменившихся `sort_order`. */
  const applyReorder = async (draggedId: number, targetId: number) => {
    // Переставляем внутри полного списка: `sorted` здесь совпадает с `documents`
    // (drag доступен только без фильтров и сортировки).
    const reordered = reorderDocuments(sorted, draggedId, targetId);
    if (!reordered) return;

    const changes = reordered
      .map((document, index) => ({ id: document.id, sortOrder: index }))
      .filter((change) => documents.find((document) => document.id === change.id)?.sortOrder !== change.sortOrder);

    // Порядок массива — источник истины для отображения: обновляем его сразу.
    setDocuments(reordered.map((document, index) => ({ ...document, sortOrder: index })));
    if (changes.length === 0) return;

    try {
      for (const change of changes) {
        await documentsApi.update(change.id, { sort_order: change.sortOrder });
      }
      toast.showToast({ message: 'Порядок документов обновлён', tone: 'success' });
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Не удалось сохранить порядок');
      await load();
    }
  };

  const reorder = useTableReorder<PublicDocument>({
    items: sorted,
    id: (document) => document.id,
    onReorder: (draggedId, targetId) => void applyReorder(draggedId, targetId),
    classNames: { dragging: styles.rowDragging, shifting: styles.rowShifting },
  });

  /** Сосед в ручном порядке — для «Переместить выше/ниже». */
  const neighborDocument = (document: PublicDocument, direction: 'up' | 'down'): PublicDocument | null => {
    const index = documents.findIndex((item) => item.id === document.id);
    const target = direction === 'up' ? index - 1 : index + 1;
    if (index === -1 || target < 0 || target >= documents.length) return null;
    return documents[target];
  };
  const canMoveDocument = (document: PublicDocument, direction: 'up' | 'down') =>
    !reorderDisabled && neighborDocument(document, direction) !== null;
  const moveDocument = (document: PublicDocument, direction: 'up' | 'down') => {
    const target = neighborDocument(document, direction);
    if (target) void applyReorder(document.id, target.id);
  };

  const columns: TableColumn<PublicDocument>[] = [
    // Ручка перетаскивания — только когда нет фильтров/сортировки.
    ...(reorderDisabled
      ? []
      : [
          {
            key: 'drag',
            header: '',
            width: '36px',
            sortable: false,
            render: (document: PublicDocument, index: number) => (
              <span
                {...reorder.getHandleProps(document, index)}
                className={[styles.dragHandle, reorder.isDraggedItem(document) ? styles.dragHandleActive : '']
                  .filter(Boolean)
                  .join(' ')}
                role="button"
                tabIndex={0}
                title="Перетащите, чтобы изменить порядок"
                aria-label="Перетащите, чтобы изменить порядок"
                onKeyDown={(event) => {
                  if (event.key === 'ArrowUp') {
                    event.preventDefault();
                    moveDocument(document, 'up');
                  } else if (event.key === 'ArrowDown') {
                    event.preventDefault();
                    moveDocument(document, 'down');
                  }
                }}
              >
                <Icon name="drag-vertical" size={16} />
              </span>
            ),
          } satisfies TableColumn<PublicDocument>,
        ]),
    {
      key: 'title',
      header: 'Название',
      render: (document) => (
        <div className={styles.cellMain}>
          <span className={styles.strong}>{document.title}</span>
          <span className={styles.note}>{document.fileName}</span>
        </div>
      ),
    },
    {
      key: 'published',
      header: 'Статус',
      render: (document) =>
        document.isPublished ? (
          <Badge tone="green" icon="check">
            Опубликован
          </Badge>
        ) : (
          <Badge tone="gray">Скрыт</Badge>
        ),
    },
    { key: 'created_at', header: 'Добавлен', render: (document) => formatDateTime(document.createdAt) },
    { key: 'updated_at', header: 'Изменён', render: (document) => formatDateTime(document.updatedAt) },
    {
      key: 'actions',
      header: '',
      width: '150px',
      sortable: false,
      render: (document) => (
        <RowActions
          ariaLabel="Действия с документом"
          items={[
            {
              key: 'move-up',
              label: 'Переместить выше',
              icon: 'arrow-up',
              placement: 'menu',
              disabled: !canMoveDocument(document, 'up'),
              onSelect: () => moveDocument(document, 'up'),
            },
            {
              key: 'move-down',
              label: 'Переместить ниже',
              icon: 'arrow-down',
              placement: 'menu',
              disabled: !canMoveDocument(document, 'down'),
              onSelect: () => moveDocument(document, 'down'),
            },
            { key: 'edit', label: 'Изменить', icon: 'edit', onSelect: () => setEditing(document) },
            { key: 'delete', label: 'Удалить', icon: 'delete', danger: true, onSelect: () => setDeleting(document) },
          ]}
        />
      ),
    },
  ];

  return (
    <Container
      title="Документы"
      actions={
        <Button icon="add" onClick={() => setCreating(true)}>
          Добавить
        </Button>
      }
    >
      <DataView
        state={state}
        mode="advanced"
        search={{ placeholder: 'Поиск по названию' }}
        columns={columns}
        rows={sorted}
        rowKey={(document) => document.id}
        total={sorted.length}
        paginated={false}
        sortable={false}
        separateBorders
        reorder={reorder}
        reorderDisabled={reorderDisabled}
        loading={loading}
        error={error}
        onRetry={() => void load()}
        emptyText="Документов пока нет"
        noResultsText="Ничего не найдено"
      />

      <DocumentFormModal
        open={creating || editing !== null}
        document={editing}
        onClose={() => {
          setCreating(false);
          setEditing(null);
        }}
        onSaved={() => {
          setCreating(false);
          setEditing(null);
          void load();
        }}
      />

      <ConfirmDialog
        open={deleting !== null}
        title="Удаление документа"
        message={`Удалить документ «${deleting?.title ?? ''}»?`}
        confirmLabel="Удалить"
        danger
        loading={deleteSaving}
        onConfirm={() => void confirmDelete()}
        onClose={() => setDeleting(null)}
      />
    </Container>
  );
}

// --- Раздел «Соглашения» ---
/** Форма создания/правки документа: создание — с файлом, правка — только метаданные. */
function DocumentFormModal({
  open,
  document,
  onClose,
  onSaved,
}: {
  open: boolean;
  document: PublicDocument | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const isEdit = document !== null;
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [published, setPublished] = useState(true);
  const [templateKind, setTemplateKind] = useState<ConsentTemplateKind | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTitle(document?.title ?? '');
    setDescription(document?.description ?? '');
    setPublished(document?.isPublished ?? true);
    setTemplateKind(document?.consentTemplateKind ?? null);
    setFile(null);
    setError(null);
  }, [open, document]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!isEdit && !file) {
      setError('Выберите файл документа');
      return;
    }
    setSaving(true);
    try {
      if (isEdit && document) {
        const payload: DocumentPayload = {
          title,
          description: description.trim() || null,
          is_published: published,
          consent_template_kind: templateKind,
        };
        await documentsApi.update(document.id, payload);
      } else {
        const formData = new FormData();
        formData.append('file', file as File);
        formData.append('title', title);
        formData.append('description', description);
        formData.append('is_published', String(published));
        formData.append('consent_template_kind', templateKind ?? '');
        await documentsApi.create(formData);
      }
      toast.showToast({ message: isEdit ? 'Документ обновлён' : 'Документ добавлен', tone: 'success' });
      onSaved();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Не удалось сохранить документ');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      title={isEdit ? 'Документ' : 'Новый документ'}
      onClose={onClose}
      width={560}
    >
      <form className={styles.form} onSubmit={handleSubmit}>
        <Input label="Название" value={title} onChange={(event) => setTitle(event.target.value)} required />
        <Textarea
          label="Описание (необязательно)"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
        {isEdit ? (
          <p className={styles.note}>
            Текущий файл: {document?.fileName}. Замена файла не поддерживается — удалите и добавьте заново.
          </p>
        ) : (
          <DragDrop
            multiple={false}
            accept=".pdf,.docx,.jpg,.png"
            onFiles={(files) => setFile(files[0] ?? null)}
            hint={file ? file.name : 'Перетащите файл документа (PDF, DOCX, изображение) или нажмите для выбора'}
          />
        )}
        <Checkbox label="Показывать на главной странице" checked={published} onChange={setPublished} />
        <div className={styles.templateGroup}>
          <span className={styles.templateLabel}>Назначить шаблоном заполнения ПДн</span>
          <Checkbox
            label="до 14 лет"
            checked={templateKind === 'minor'}
            onChange={(checked) => setTemplateKind(checked ? 'minor' : null)}
          />
          <Checkbox
            label="после 14 лет"
            checked={templateKind === 'adult'}
            onChange={(checked) => setTemplateKind(checked ? 'adult' : null)}
          />
          <span className={styles.note}>
            Шаблон отдаётся по ссылке «Образец согласия ПДн» в форме заявки. Для каждого возраста —
            один документ.
          </span>
        </div>
        {error ? <div className={styles.error}>{error}</div> : null}
        <div className={styles.formActions}>
          <Button variant="secondary" type="button" onClick={onClose} disabled={saving}>
            Отмена
          </Button>
          <Button type="submit" icon="check" loading={saving}>
            Сохранить
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// --- Раздел «Соглашения» ---

function ConsentsTab() {
  const toast = useToast();
  const [documents, setDocuments] = useState<ConsentDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [publishing, setPublishing] = useState<ConsentDocumentType | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await consentsApi.list();
      setDocuments(response.documents);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Не удалось загрузить соглашения');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const currentByType = (type: ConsentDocumentType): ConsentDocument | undefined =>
    documents.find((document) => document.type === type);

  return (
    <Container title="Соглашения">
      <p className={styles.note}>
        Тексты публикуются как неизменяемые редакции: при правке создаётся новая версия, старая сохраняется
        (версия + SHA-256). Пользователи принимают действующую редакцию при регистрации.
      </p>

      {loading ? (
        <StateMessage state="loading" />
      ) : error ? (
        <StateMessage state="error" message={error} onRetry={() => void load()} />
      ) : (
        <div className={styles.consents}>
          {Object.values(ConsentDocumentType).map((type) => {
            const current = currentByType(type);
            const history = documents.filter((document) => document.type === type);
            return (
              <section key={type} className={styles.consentCard}>
                <header className={styles.consentHeader}>
                  <h3 className={styles.consentTitle}>{CONSENT_LABELS[type]}</h3>
                  <Button size="sm" icon="add" onClick={() => setPublishing(type)}>
                    Новая редакция
                  </Button>
                </header>
                {current ? (
                  <p className={styles.note}>
                    Действующая версия: <strong>{current.version}</strong> · от{' '}
                    {formatDateTime(current.publishedAt)}
                  </p>
                ) : (
                  <p className={styles.note}>Действующая версия не опубликована</p>
                )}
                <ul className={styles.history}>
                  {history.map((document) => (
                    <li key={document.id} className={styles.historyItem}>
                      <span className={styles.strong}>{document.version}</span>
                      <span className={styles.note}>{formatDateTime(document.publishedAt)}</span>
                      <code className={styles.hash} title={document.hash}>
                        {document.hash.slice(0, 12)}…
                      </code>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}

      {publishing ? (
        <PublishConsentModal
          type={publishing}
          current={currentByType(publishing) ?? null}
          onClose={() => setPublishing(null)}
          onSaved={() => {
            setPublishing(null);
            toast.showToast({ message: 'Новая редакция опубликована', tone: 'success' });
            void load();
          }}
        />
      ) : null}
    </Container>
  );
}

/** Публикация новой редакции текста соглашения: версия + полный текст. */
function PublishConsentModal({
  type,
  current,
  onClose,
  onSaved,
}: {
  type: ConsentDocumentType;
  current: ConsentDocument | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [version, setVersion] = useState('');
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setVersion('');
    setText(current?.text ?? '');
    setError(null);
  }, [type, current]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!text.trim()) {
      setError('Введите текст редакции');
      return;
    }
    setSaving(true);
    try {
      await consentsApi.publish({ document_type: type, version: version.trim() || undefined, text });
      onSaved();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Не удалось опубликовать редакцию');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open title={`Новая редакция: ${CONSENT_LABELS[type]}`} onClose={onClose} width={720}>
      <form className={styles.form} onSubmit={handleSubmit}>
        <Input
          label="Версия (необязательно)"
          value={version}
          onChange={(event) => setVersion(event.target.value)}
          placeholder="Например, 2026-11-01 (по умолчанию — текущая дата)"
        />
        <Textarea
          label="Текст редакции (Markdown)"
          value={text}
          onChange={(event) => setText(event.target.value)}
          rows={16}
        />
        <p className={styles.note}>
          Старые редакции не изменяются: при совпадении версии публикация будет отклонена — укажите новую.
        </p>
        {error ? <div className={styles.error}>{error}</div> : null}
        <div className={styles.formActions}>
          <Button variant="secondary" type="button" onClick={onClose} disabled={saving}>
            Отмена
          </Button>
          <Button type="submit" icon="check" loading={saving}>
            Опубликовать
          </Button>
        </div>
      </form>
    </Modal>
  );
}
