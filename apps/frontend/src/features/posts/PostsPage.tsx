// Раздел «Публикации»: жизненный цикл (черновик → запланирована → опубликована → архив),
// WYSIWYG-редактор (Markdown), вложения.
import { lazy, Suspense, useCallback, useEffect, useState, type FormEvent } from 'react';
import type { PostStatus } from '@arbuz/shared';
import { PostStatuses } from '../../lib/post-status';
import {
  Badge,
  Button,
  Checkbox,
  ConfirmDialog,
  Container,
  DatePicker,
  DragDrop,
  Input,
  ListToolbar,
  Modal,
  Pagination,
  SearchInput,
  Select,
  StateMessage,
  StatusBadge,
  Table,
  useToast,
} from '../../components/ui';
import type { SelectOption, StatusOption, TableColumn } from '../../components/ui';
import { postsApi, type Post, type PostFile, type PostPayload } from '../../api/posts';
import { ApiError } from '../../api/client';
import { formatDateTime } from '../../lib/format';
import styles from './PostsPage.module.css';

// Тяжёлый WYSIWYG-редактор грузим отдельным чанком только при работе с публикацией.
const PostEditor = lazy(() => import('./PostEditor/PostEditor').then((module) => ({ default: module.PostEditor })));

const PAGE_SIZE_OPTIONS = [20, 50, 100] as const;

const POST_STATUS_OPTIONS: readonly StatusOption<PostStatus>[] = [
  { value: PostStatuses.draft, label: 'Черновик', tone: 'gray' },
  { value: PostStatuses.scheduled, label: 'Запланирована', tone: 'yellow' },
  { value: PostStatuses.published, label: 'Опубликована', tone: 'green' },
  { value: PostStatuses.archived, label: 'В архиве', tone: 'neutral' },
];

const POST_FILTER_OPTIONS: readonly SelectOption<PostStatus>[] = POST_STATUS_OPTIONS.map((option) => ({
  value: option.value,
  label: option.label,
}));

/** Режим публикации в форме: черновик / сразу / отложенно. */
const PUBLISH_MODE = { draft: 'draft', now: 'now', scheduled: 'scheduled' } as const;
type PublishMode = (typeof PUBLISH_MODE)[keyof typeof PUBLISH_MODE];

const PUBLISH_MODE_OPTIONS: readonly SelectOption<PublishMode>[] = [
  { value: PUBLISH_MODE.draft, label: 'Черновик — в ленте не показывать' },
  { value: PUBLISH_MODE.now, label: 'Опубликовать сейчас' },
  { value: PUBLISH_MODE.scheduled, label: 'Запланировать на дату' },
];

/** `yyyy-mm-dd` на завтра — минимальная дата для планирования. */
function tomorrowInputValue(): string {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/** ISO-строка с сервера → `yyyy-mm-dd` в локальной зоне (для DatePicker). */
function isoToDateInput(iso: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/** `yyyy-mm-dd` → ISO (полночь локального дня); пусто → null. */
function dateInputToIso(value: string): string | null {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/**
 * Полный payload публикации: PATCH заменяет документ целиком.
 * `override` задаёт изменяемые поля, остальные берутся из текущей публикации —
 * поэтому же вызов без override возвращает её к исходному состоянию (для «Отменить»).
 */
function buildPayload(post: Post, override: Partial<PostPayload> = {}): PostPayload {
  return {
    title: post.title,
    content: post.content,
    is_published: post.status !== PostStatuses.draft,
    hide_author: post.hideAuthor,
    scheduled_at: post.scheduledAt,
    archived: post.status === PostStatuses.archived,
    ...override,
  };
}

/** Список уже прикреплённых к публикации файлов (для сохранённого поста). */
function AttachmentsList({ postId }: { postId: number }) {
  const toast = useToast();
  const [files, setFiles] = useState<PostFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await postsApi.files.list(postId);
      setFiles(response.files);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Не удалось загрузить вложения');
    } finally {
      setLoading(false);
    }
  }, [postId]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleRemove = async (fileId: number) => {
    setError(null);
    try {
      await postsApi.files.remove(postId, fileId);
      await load();
      toast.showToast({ message: 'Вложение удалено', tone: 'success' });
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Не удалось удалить файл');
    }
  };

  if (loading) return <StateMessage state="loading" />;
  if (files.length === 0) return null;

  return (
    <div className={styles.fileList}>
      {error ? <div className={styles.error}>{error}</div> : null}
      {files.map((file) => (
        <span key={file.id} className={styles.fileItem}>
          <Badge tone="blue" icon="document">
            <span className={styles.fileName} title={file.name}>
              {file.name}
            </span>
          </Badge>
          <Button size="sm" variant="ghost" icon="delete" aria-label="Удалить вложение" onClick={() => void handleRemove(file.id)} />
        </span>
      ))}
    </div>
  );
}

function PostFormModal({
  open,
  initial,
  preferredMode,
  onClose,
  onSaved,
}: {
  open: boolean;
  initial: Post | null;
  /** Предвыбранный режим (например, «Запланировать» из списка). */
  preferredMode?: PublishMode;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const toast = useToast();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [mode, setMode] = useState<PublishMode>(PUBLISH_MODE.draft);
  const [scheduledDate, setScheduledDate] = useState('');
  const [hideAuthor, setHideAuthor] = useState(false);
  // Файлы, выбранные до сохранения: загружаем их сразу после создания/обновления.
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const archived = initial?.status === PostStatuses.archived;

  useEffect(() => {
    if (!open) return;
    setTitle(initial?.title ?? '');
    setContent(initial?.content ?? '');
    setMode(
      preferredMode ??
        (initial?.status === PostStatuses.scheduled
          ? PUBLISH_MODE.scheduled
          : initial && initial.status !== PostStatuses.draft
            ? PUBLISH_MODE.now
            : PUBLISH_MODE.draft),
    );
    setScheduledDate(isoToDateInput(initial?.scheduledAt ?? null));
    setHideAuthor(initial?.hideAuthor ?? false);
    setPendingFiles([]);
    setError(null);
  }, [open, initial, preferredMode]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (mode === PUBLISH_MODE.scheduled && !scheduledDate) {
      setError('Выберите дату отложенной публикации');
      return;
    }
    setSaving(true);
    try {
      const payload: PostPayload = {
        title: title.trim(),
        content,
        is_published: mode !== PUBLISH_MODE.draft,
        hide_author: hideAuthor,
        scheduled_at: mode === PUBLISH_MODE.scheduled ? dateInputToIso(scheduledDate) : null,
        // Архив — отдельное действие в списке: при правке статус архива сохраняем.
        archived,
      };
      let postId: number;
      if (initial) {
        await postsApi.update(initial.id, payload);
        postId = initial.id;
      } else {
        const response = await postsApi.create(payload);
        postId = response.post.id;
      }

      for (const file of pendingFiles) {
        await postsApi.files.upload(postId, file);
      }

      await onSaved();
      toast.showToast({
        message: pendingFiles.length > 0 ? 'Публикация сохранена, вложения загружены' : 'Публикация сохранена',
        tone: 'success',
      });
      // В обоих режимах закрываем окно: повторное «Сохранить» больше не создаёт дубликат.
      onClose();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Не удалось сохранить публикацию');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} title={initial ? 'Редактировать публикацию' : 'Новая публикация'} onClose={onClose} width={880}>
      <form className={styles.form} onSubmit={handleSubmit}>
        <Input label="Заголовок" value={title} onChange={(e) => setTitle(e.target.value)} required fullWidth />

        <div className={styles.formRow}>
          {archived ? (
            <p className={styles.note}>
              Публикация в архиве: её не видно в ленте. Вернуть — кнопкой «Из архива» в списке.
            </p>
          ) : (
            <>
              <Select
                label="Публикация"
                value={mode}
                onChange={(value) => setMode(value as PublishMode)}
                options={PUBLISH_MODE_OPTIONS}
              />
              {mode === PUBLISH_MODE.scheduled ? (
                <DatePicker
                  label="Дата выхода"
                  value={scheduledDate}
                  onChange={setScheduledDate}
                  min={tomorrowInputValue()}
                />
              ) : null}
            </>
          )}
        </div>

        <div className={styles.formFlags}>
          <Checkbox label="Скрыть автора в ленте" checked={hideAuthor} onChange={setHideAuthor} />
        </div>

        <div className={styles.editorWrap}>
          <span className={styles.sectionLabel}>Содержание публикации</span>
          <Suspense fallback={<StateMessage state="loading" />}>
            <PostEditor markdown={content} onChange={setContent} />
          </Suspense>
        </div>

        <div className={styles.attachments}>
          <span className={styles.sectionLabel}>Вложения</span>
          <DragDrop
            onFiles={(selected) => setPendingFiles((prev) => [...prev, ...selected])}
            disabled={saving}
            hint="Перетащите файлы (PDF, DOCX, изображения, MP4) — они загрузятся при сохранении"
          />
          {pendingFiles.length > 0 ? (
            <div className={styles.fileList}>
              {pendingFiles.map((file, index) => (
                <span key={`${file.name}-${index}`} className={styles.fileItem}>
                  <Badge tone="blue" icon="document">
                    <span className={styles.fileName} title={file.name}>
                      {file.name}
                    </span>
                  </Badge>
                  <Button
                    size="sm"
                    variant="ghost"
                    icon="close"
                    aria-label="Убрать из списка"
                    onClick={() => setPendingFiles((prev) => prev.filter((_, itemIndex) => itemIndex !== index))}
                  />
                </span>
              ))}
            </div>
          ) : null}
          {initial ? <AttachmentsList postId={initial.id} /> : null}
        </div>

        {error ? <div className={styles.error}>{error}</div> : null}
        <div className={styles.formActions}>
          <Button variant="secondary" type="button" onClick={onClose} disabled={saving}>
            Закрыть
          </Button>
          <Button type="submit" icon="check" loading={saving}>
            Сохранить
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export function PostsPage() {
  const toast = useToast();
  const [posts, setPosts] = useState<Post[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(PAGE_SIZE_OPTIONS[0]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<PostStatus | ''>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Post | null>(null);
  const [scheduling, setScheduling] = useState<Post | null>(null);
  const [deleting, setDeleting] = useState<Post | null>(null);
  const [deleteSaving, setDeleteSaving] = useState(false);
  /** Публикация, для которой выполняется действие: блокирует повторные клики. */
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await postsApi.list({
        limit: pageSize,
        offset: (page - 1) * pageSize,
        search: search || undefined,
        status: statusFilter || undefined,
      });
      setPosts(response.posts);
      setTotal(response.total);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Не удалось загрузить публикации');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, search, statusFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  /** Точечная замена публикации в списке (без полной перезагрузки страницы). */
  const replacePost = (post: Post) => setPosts((prev) => prev.map((item) => (item.id === post.id ? post : item)));

  const revert = async (post: Post) => {
    try {
      const response = await postsApi.update(post.id, buildPayload(post));
      replacePost(response.post);
      toast.showToast({ message: 'Изменение отменено', tone: 'info' });
    } catch {
      setError('Не удалось отменить изменение публикации');
      await load();
    }
  };

  /**
   * Быстрые действия над публикацией (опубликовать, в архив, из архива).
   * `override` — что меняем; кнопка «Отменить» возвращает исходное состояние.
   */
  const applyChange = async (post: Post, override: Partial<PostPayload>, success: string) => {
    setError(null);
    setBusyId(post.id);
    try {
      const response = await postsApi.update(post.id, buildPayload(post, override));
      replacePost(response.post);
      toast.showToast({
        message: success,
        tone: 'success',
        action: { label: 'Отменить', onClick: () => void revert(post) },
      });
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Не удалось изменить публикацию');
      await load();
    } finally {
      setBusyId(null);
    }
  };

  const publishNow = (post: Post) =>
    applyChange(post, { is_published: true, scheduled_at: null }, 'Публикация опубликована');

  const handleDelete = async () => {
    if (!deleting) return;
    setDeleteSaving(true);
    try {
      await postsApi.remove(deleting.id);
      setDeleting(null);
      toast.showToast({ message: 'Публикация удалена', tone: 'success' });
      await load();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Не удалось удалить публикацию');
    } finally {
      setDeleteSaving(false);
    }
  };

  const columns: TableColumn<Post>[] = [
    {
      key: 'title',
      header: 'Заголовок',
      render: (post) => (
        <div className={styles.cellMain}>
          <span className={styles.postTitle}>{post.title}</span>
          {post.status === PostStatuses.scheduled && post.scheduledAt ? (
            <span className={styles.note}>Выйдет {formatDateTime(post.scheduledAt)}</span>
          ) : null}
          {post.editedAt ? (
            <span className={styles.note}>Отредактировано от {formatDateTime(post.editedAt)}</span>
          ) : null}
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Статус',
      render: (post) => <StatusBadge value={post.status} options={POST_STATUS_OPTIONS} />,
    },
    {
      key: 'author',
      header: 'Автор',
      render: (post) =>
        post.hideAuthor ? <Badge tone="gray">Скрыт</Badge> : post.authorName ?? <Badge tone="neutral">—</Badge>,
    },
    { key: 'created', header: 'Создана', render: (post) => formatDateTime(post.createdAt) },
    {
      key: 'actions',
      header: '',
      width: '300px',
      render: (post) => {
        const busy = busyId === post.id;
        return (
          <div className={styles.actions}>
            {post.status === PostStatuses.archived ? (
              <Button
                size="sm"
                variant="secondary"
                disabled={busy}
                title="Вернуть публикацию в ленту"
                onClick={() => void applyChange(post, { archived: false }, 'Публикация возвращена из архива')}
              >
                Из архива
              </Button>
            ) : post.status === PostStatuses.published ? (
              <Button
                size="sm"
                variant="secondary"
                disabled={busy}
                title="Скрыть публикацию с домашней страницы"
                onClick={() => void applyChange(post, { archived: true }, 'Публикация в архиве')}
              >
                В архив
              </Button>
            ) : (
              <>
                <Button
                  size="sm"
                  variant="secondary"
                  icon="check"
                  disabled={busy}
                  title="Опубликовать сейчас"
                  onClick={() => void publishNow(post)}
                >
                  Опубликовать
                </Button>
                {post.status === PostStatuses.draft ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    icon="calendar"
                    disabled={busy}
                    title="Выбрать дату выхода"
                    onClick={() => setScheduling(post)}
                  >
                    Запланировать
                  </Button>
                ) : null}
              </>
            )}
            <Button size="sm" variant="ghost" icon="edit" aria-label="Изменить" disabled={busy} onClick={() => setEditing(post)} />
            <Button size="sm" variant="ghost" icon="delete" aria-label="Удалить" disabled={busy} onClick={() => setDeleting(post)} />
          </div>
        );
      },
    },
  ];

  return (
    <Container
      title="Публикации"
      actions={
        <Button icon="add" onClick={() => setCreating(true)}>
          Добавить
        </Button>
      }
    >
      <ListToolbar>
        <SearchInput
          placeholder="Поиск по заголовку"
          onChange={(value) => {
            setSearch(value);
            setPage(1);
          }}
        />
        <Select
          label="Статус"
          placeholder="Все публикации"
          value={statusFilter}
          onChange={(value) => {
            setStatusFilter(value as PostStatus | '');
            setPage(1);
          }}
          options={POST_FILTER_OPTIONS}
        />
      </ListToolbar>

      {loading ? (
        <StateMessage state="loading" />
      ) : error ? (
        <StateMessage state="error" message={error} onRetry={() => void load()} />
      ) : posts.length === 0 ? (
        <StateMessage state="empty" message="Публикаций пока нет" />
      ) : (
        <>
          <Table columns={columns} data={posts} rowKey={(post) => post.id} />
          <Pagination
            page={page}
            pageSize={pageSize}
            total={total}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
            pageSizeOptions={PAGE_SIZE_OPTIONS}
          />
        </>
      )}

      <PostFormModal open={creating} initial={null} onClose={() => setCreating(false)} onSaved={load} />
      <PostFormModal open={editing !== null} initial={editing} onClose={() => setEditing(null)} onSaved={load} />
      <PostFormModal
        open={scheduling !== null}
        initial={scheduling}
        preferredMode={PUBLISH_MODE.scheduled}
        onClose={() => setScheduling(null)}
        onSaved={load}
      />
      <ConfirmDialog
        open={deleting !== null}
        title="Удаление публикации"
        message={`Удалить публикацию «${deleting?.title ?? ''}»?`}
        confirmLabel="Удалить"
        danger
        loading={deleteSaving}
        onConfirm={() => void handleDelete()}
        onClose={() => setDeleting(null)}
      />
    </Container>
  );
}
