// Раздел «Публикации»: CRUD, WYSIWYG-редактор (Markdown), вложения.
import { lazy, Suspense, useCallback, useEffect, useState, type FormEvent } from 'react';
import {
  Badge,
  Button,
  Checkbox,
  ConfirmDialog,
  Container,
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
import { postsApi, type Post, type PostFile } from '../../api/posts';
import { ApiError } from '../../api/client';
import { formatDateTime } from '../../lib/format';
import styles from './PostsPage.module.css';

// Тяжёлый WYSIWYG-редактор грузим отдельным чанком только при работе с публикацией.
const PostEditor = lazy(() => import('./PostEditor/PostEditor').then((module) => ({ default: module.PostEditor })));

const POST_STATUS = { draft: 'draft', published: 'published' } as const;

const PAGE_SIZE_OPTIONS = [20, 50, 100] as const;

const POST_STATUS_OPTIONS: readonly StatusOption<string>[] = [
  { value: POST_STATUS.draft, label: 'Не опубликован', tone: 'gray' },
  { value: POST_STATUS.published, label: 'Опубликован', tone: 'green' },
];

const POST_FILTER_OPTIONS: readonly SelectOption<string>[] = [
  { value: POST_STATUS.draft, label: 'Не опубликованные' },
  { value: POST_STATUS.published, label: 'Опубликованные' },
];

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
  onClose,
  onSaved,
}: {
  open: boolean;
  initial: Post | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const toast = useToast();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isPublished, setIsPublished] = useState(false);
  const [hideAuthor, setHideAuthor] = useState(false);
  // Файлы, выбранные до сохранения: загружаем их сразу после создания/обновления.
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTitle(initial?.title ?? '');
    setContent(initial?.content ?? '');
    setIsPublished(initial?.is_published ?? false);
    setHideAuthor(initial?.hideAuthor ?? false);
    setPendingFiles([]);
    setError(null);
  }, [open, initial]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const payload = { title: title.trim(), content, is_published: isPublished, hide_author: hideAuthor };
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
        <div className={styles.formHeader}>
          <Input label="Заголовок" value={title} onChange={(e) => setTitle(e.target.value)} required fullWidth />
        </div>
        <div className={styles.formFlags}>
          <Checkbox label="Опубликована" checked={isPublished} onChange={setIsPublished} />
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
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Post | null>(null);
  const [deleting, setDeleting] = useState<Post | null>(null);
  const [deleteSaving, setDeleteSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await postsApi.list({
        limit: pageSize,
        offset: (page - 1) * pageSize,
        search: search || undefined,
        isPublished: statusFilter ? statusFilter === POST_STATUS.published : undefined,
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

  const togglePublished = async (post: Post, published: boolean) => {
    setError(null);
    const previousPublished = post.is_published;
    const payload = {
      title: post.title,
      content: post.content,
      is_published: published,
      hide_author: post.hideAuthor,
    };
    try {
      const response = await postsApi.update(post.id, payload);
      setPosts((prev) => prev.map((item) => (item.id === post.id ? response.post : item)));
      toast.showToast({
        message: published ? 'Публикация опубликована' : 'Снята с публикации',
        tone: 'success',
        action: {
          label: 'Отменить',
          onClick: () => {
            void postsApi
              .update(post.id, { ...payload, is_published: previousPublished })
              .then((reverted) => {
                setPosts((prev) => prev.map((item) => (item.id === post.id ? reverted.post : item)));
              })
              .catch(() => {
                setError('Не удалось отменить изменение публикации');
                void load();
              });
          },
        },
      });
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Не удалось изменить публикацию');
      await load();
    }
  };

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
    { key: 'title', header: 'Заголовок', field: 'title' },
    {
      key: 'status',
      header: 'Статус',
      render: (post) => (
        <StatusBadge
          value={post.is_published ? POST_STATUS.published : POST_STATUS.draft}
          options={POST_STATUS_OPTIONS}
          onChange={(value) => void togglePublished(post, value === POST_STATUS.published)}
        />
      ),
    },
    {
      key: 'author',
      header: 'Автор',
      render: (post) =>
        post.hideAuthor ? <Badge tone="gray">Скрыт</Badge> : post.authorName ?? <Badge tone="neutral">—</Badge>,
    },
    { key: 'updated', header: 'Обновлена', render: (post) => formatDateTime(post.updatedAt) },
    {
      key: 'actions',
      header: '',
      width: '100px',
      render: (post) => (
        <div className={styles.actions}>
          <Button size="sm" variant="ghost" icon="edit" aria-label="Изменить" onClick={() => setEditing(post)} />
          <Button size="sm" variant="ghost" icon="delete" aria-label="Удалить" onClick={() => setDeleting(post)} />
        </div>
      ),
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
            setStatusFilter(value);
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
