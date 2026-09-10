// Раздел «Посты»: CRUD, Markdown с живым предпросмотром, вложения.
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
  StateMessage,
  StatusBadge,
  Table,
  Textarea,
} from '../../components/ui';
import type { StatusOption, TableColumn } from '../../components/ui';
import { postsApi, type Post, type PostFile } from '../../api/posts';
import { ApiError } from '../../api/client';
import { formatDateTime } from '../../lib/format';
import styles from './PostsPage.module.css';

const POST_STATUS_OPTIONS: readonly StatusOption<string>[] = [
  { value: 'draft', label: 'Черновик', tone: 'gray' },
  { value: 'published', label: 'Опубликован', tone: 'green' },
];

function AttachmentsSection({ postId }: { postId: number }) {
  const [files, setFiles] = useState<PostFile[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const response = await postsApi.files.list(postId);
      setFiles(response.files);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Не удалось загрузить вложения');
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
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Не удалось удалить файл');
    }
  };

  return (
    <div className={styles.attachments}>
      <span className={styles.sectionLabel}>Вложения</span>
      <DragDrop onFiles={(selected) => void handleFiles(selected)} disabled={busy} hint="Перетащите файлы (PDF, DOCX, изображения, MP4)" />
      {error ? <div className={styles.error}>{error}</div> : null}
      {files.length > 0 ? (
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
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isPublished, setIsPublished] = useState(false);
  const [preview, setPreview] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedPostId, setSavedPostId] = useState<number | null>(null);

  useEffect(() => {
    if (!open) return;
    setTitle(initial?.title ?? '');
    setContent(initial?.content ?? '');
    setIsPublished(initial?.is_published ?? false);
    setPreview(initial?.contentHtml ?? '');
    setError(null);
    setSavedPostId(initial?.id ?? null);
  }, [open, initial]);

  // Живой предпросмотр: Markdown рендерит и санитизирует сервер (debounce).
  useEffect(() => {
    if (!open) return undefined;
    const timer = setTimeout(() => {
      postsApi
        .preview(content)
        .then((response) => setPreview(response.html))
        .catch(() => undefined);
    }, 400);
    return () => clearTimeout(timer);
  }, [content, open]);

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
        <div className={styles.editor}>
          <Textarea
            label="Markdown"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            required
            hint="Поддерживается Markdown; HTML не принимается"
          />
          <div className={styles.previewColumn}>
            <span className={styles.sectionLabel}>Предпросмотр</span>
            <div className={styles.preview} dangerouslySetInnerHTML={{ __html: preview }} />
          </div>
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
  const [posts, setPosts] = useState<Post[]>([]);
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
      const response = await postsApi.list();
      setPosts(response.posts);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Не удалось загрузить посты');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const togglePublished = async (post: Post, published: boolean) => {
    setError(null);
    try {
      const response = await postsApi.update(post.id, {
        title: post.title,
        content: post.content,
        is_published: published,
      });
      setPosts((prev) => prev.map((item) => (item.id === post.id ? response.post : item)));
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
          value={post.is_published ? 'published' : 'draft'}
          options={POST_STATUS_OPTIONS}
          onChange={(value) => void togglePublished(post, value === 'published')}
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
        <Table columns={columns} data={posts} rowKey={(post) => post.id} />
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
