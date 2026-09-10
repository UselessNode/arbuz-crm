// Раздел «Посты»: CRUD, WYSIWYG-редактор (Markdown), вложения.
import { lazy, Suspense, useCallback, useEffect, useState, type FormEvent } from 'react';
import {
  Badge,
  Button,
  Checkbox,
  ConfirmDialog,
  Container,
  DragDrop,
  Input,
  Modal,
  Pagination,
  StateMessage,
  StatusBadge,
  Table,
  useToast,
} from '../../components/ui';
import type { StatusOption, TableColumn } from '../../components/ui';
import { postsApi, type Post, type PostFile } from '../../api/posts';
import { ApiError } from '../../api/client';
import { formatDateTime } from '../../lib/format';
import styles from './PostsPage.module.css';

// Тяжёлый WYSIWYG-редактор грузим отдельным чанком только при работе с постом.
const PostEditor = lazy(() => import('./PostEditor/PostEditor').then((module) => ({ default: module.PostEditor })));

const POST_STATUS = { draft: 'draft', published: 'published' } as const;

const PAGE_SIZE_OPTIONS = [20, 50, 100] as const;

const POST_STATUS_OPTIONS: readonly StatusOption<string>[] = [
  { value: POST_STATUS.draft, label: 'Черновик', tone: 'gray' },
  { value: POST_STATUS.published, label: 'Опубликован', tone: 'green' },
];

function AttachmentsSection({ postId }: { postId: number }) {
  const toast = useToast();
  const [files, setFiles] = useState<PostFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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

  const handleFiles = async (selected: File[]) => {
    setError(null);
    setBusy(true);
    try {
      for (const file of selected) {
        await postsApi.files.upload(postId, file);
      }
      await load();
      toast.showToast({ message: selected.length > 1 ? 'Вложения загружены' : 'Вложение загружено', tone: 'success' });
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Не удалось загрузить файл');
    } finally {
      setBusy(false);
    }
  };

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

  return (
    <div className={styles.attachments}>
      <span className={styles.sectionLabel}>Вложения</span>
      <DragDrop onFiles={(selected) => void handleFiles(selected)} disabled={busy} hint="Перетащите файлы (PDF, DOCX, изображения, MP4)" />
      {error ? <div className={styles.error}>{error}</div> : null}
      {loading ? (
        <StateMessage state="loading" />
      ) : files.length > 0 ? (
        <div className={styles.fileList}>
          {files.map((file) => (
            <span key={file.id} className={styles.fileItem}>
              <Badge tone="blue" icon="document">
                {file.name}
              </Badge>
              <Button size="sm" variant="ghost" icon="delete" aria-label="Удалить" onClick={() => void handleRemove(file.id)} />
            </span>
          ))}
        </div>
      ) : null}
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
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedPostId, setSavedPostId] = useState<number | null>(null);

  useEffect(() => {
    if (!open) return;
    setTitle(initial?.title ?? '');
    setContent(initial?.content ?? '');
    setIsPublished(initial?.is_published ?? false);
    setError(null);
    setSavedPostId(initial?.id ?? null);
  }, [open, initial]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const payload = { title: title.trim(), content, is_published: isPublished };
      if (initial) {
        await postsApi.update(initial.id, payload);
      } else {
        const response = await postsApi.create(payload);
        setSavedPostId(response.post.id);
      }
      await onSaved();
      toast.showToast({ message: 'Пост сохранён', tone: 'success' });
      if (initial) onClose();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Не удалось сохранить пост');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} title={initial ? 'Редактировать пост' : 'Новый пост'} onClose={onClose} width={880}>
      <form className={styles.form} onSubmit={handleSubmit}>
        <div className={styles.formHeader}>
          <Input label="Заголовок" value={title} onChange={(e) => setTitle(e.target.value)} required />
          <Checkbox label="Опубликован" checked={isPublished} onChange={setIsPublished} />
        </div>
        <div className={styles.editorWrap}>
          <span className={styles.sectionLabel}>Содержание публикации</span>
          <Suspense fallback={<StateMessage state="loading" />}>
            <PostEditor markdown={content} onChange={setContent} />
          </Suspense>
        </div>

        {savedPostId !== null ? <AttachmentsSection postId={savedPostId} /> : null}

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
      const response = await postsApi.list({ limit: pageSize, offset: (page - 1) * pageSize });
      setPosts(response.posts);
      setTotal(response.total);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Не удалось загрузить посты');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize]);

  useEffect(() => {
    void load();
  }, [load]);

  const togglePublished = async (post: Post, published: boolean) => {
    setError(null);
    const previousPublished = post.is_published;
    try {
      const response = await postsApi.update(post.id, {
        title: post.title,
        content: post.content,
        is_published: published,
      });
      setPosts((prev) => prev.map((item) => (item.id === post.id ? response.post : item)));
      toast.showToast({
        message: published ? 'Пост опубликован' : 'Снят с публикации',
        tone: 'success',
        action: {
          label: 'Отменить',
          onClick: () => {
            void postsApi
              .update(post.id, { title: post.title, content: post.content, is_published: previousPublished })
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
      toast.showToast({ message: 'Пост удалён', tone: 'success' });
      await load();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Не удалось удалить пост');
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
    { key: 'author', header: 'Автор', render: (post) => post.authorName ?? '—' },
    { key: 'updated', header: 'Обновлён', render: (post) => formatDateTime(post.updatedAt) },
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
      title="Посты"
      actions={
        <Button icon="add" onClick={() => setCreating(true)}>
          Добавить
        </Button>
      }
    >
      {loading ? (
        <StateMessage state="loading" />
      ) : error ? (
        <StateMessage state="error" message={error} onRetry={() => void load()} />
      ) : posts.length === 0 ? (
        <StateMessage state="empty" message="Постов пока нет" />
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
        title="Удаление поста"
        message={`Удалить пост «${deleting?.title ?? ''}»?`}
        confirmLabel="Удалить"
        danger
        loading={deleteSaving}
        onConfirm={() => void handleDelete()}
        onClose={() => setDeleting(null)}
      />
    </Container>
  );
}
