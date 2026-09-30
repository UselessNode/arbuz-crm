// Админский раздел «Документы и согласия»: два раздела на одной странице.
//  • «Документы» — публичные файлы (главная страница): загрузка, порядок, публикация.
//  • «Соглашения» — версии текстов (ПС и ПДн): история и публикация новой редакции.
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import {
  Badge,
  Button,
  Checkbox,
  ConfirmDialog,
  Container,
  DragDrop,
  Input,
  Modal,
  NumberInput,
  StateMessage,
  Table,
  Textarea,
  useToast,
} from '../../components/ui';
import type { TableColumn } from '../../components/ui';
import { documentsApi, type DocumentPayload, type PublicDocument } from '../../api/documents';
import { consentsApi, ConsentDocumentType, type ConsentDocument } from '../../api/consents';
import { ApiError } from '../../api/client';
import { formatDateTime } from '../../lib/format';
import styles from './DocumentsPage.module.css';

type Tab = 'documents' | 'consents';

const CONSENT_LABELS: Record<ConsentDocumentType, string> = {
  [ConsentDocumentType.terms]: 'Пользовательское соглашение',
  [ConsentDocumentType.personal_data_consent]: 'Согласие на обработку персональных данных',
};

export function DocumentsPage() {
  const [tab, setTab] = useState<Tab>('documents');

  return (
    <Container
      title="Документы и согласия"
      actions={
        <div className={styles.tabs} role="tablist" aria-label="Разделы">
          <Button
            size="sm"
            variant={tab === 'documents' ? 'primary' : 'secondary'}
            onClick={() => setTab('documents')}
          >
            Документы
          </Button>
          <Button
            size="sm"
            variant={tab === 'consents' ? 'primary' : 'secondary'}
            onClick={() => setTab('consents')}
          >
            Соглашения
          </Button>
        </div>
      }
    >
      {tab === 'documents' ? <DocumentsTab /> : <ConsentsTab />}
    </Container>
  );
}

// --- Раздел «Документы» ---

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

  const columns: TableColumn<PublicDocument>[] = [
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
    { key: 'order', header: 'Порядок', width: '90px', render: (document) => document.sortOrder },
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
    { key: 'created', header: 'Добавлен', render: (document) => formatDateTime(document.createdAt) },
    {
      key: 'actions',
      header: '',
      width: '120px',
      render: (document) => (
        <div className={styles.actions}>
          <Button size="sm" variant="ghost" icon="edit" aria-label="Изменить" onClick={() => setEditing(document)} />
          <Button size="sm" variant="ghost" icon="delete" aria-label="Удалить" onClick={() => setDeleting(document)} />
        </div>
      ),
    },
  ];

  return (
    <>
      <div className={styles.toolbar}>
        <Button icon="add" onClick={() => setCreating(true)}>
          Добавить документ
        </Button>
      </div>

      {loading ? (
        <StateMessage state="loading" />
      ) : error ? (
        <StateMessage state="error" message={error} onRetry={() => void load()} />
      ) : documents.length === 0 ? (
        <StateMessage state="empty" message="Документов пока нет" />
      ) : (
        <Table columns={columns} data={documents} rowKey={(document) => document.id} />
      )}

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
    </>
  );
}

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
  const [sortOrder, setSortOrder] = useState(0);
  const [published, setPublished] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTitle(document?.title ?? '');
    setDescription(document?.description ?? '');
    setSortOrder(document?.sortOrder ?? 0);
    setPublished(document?.isPublished ?? true);
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
          sort_order: sortOrder,
          is_published: published,
        };
        await documentsApi.update(document.id, payload);
      } else {
        const formData = new FormData();
        formData.append('file', file as File);
        formData.append('title', title);
        formData.append('description', description);
        formData.append('sort_order', String(sortOrder));
        formData.append('is_published', String(published));
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
        <NumberInput label="Порядок (меньше — выше)" value={sortOrder} onChange={setSortOrder} />
        <Checkbox label="Показывать на главной странице" checked={published} onChange={setPublished} />
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
    <>
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
    </>
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
