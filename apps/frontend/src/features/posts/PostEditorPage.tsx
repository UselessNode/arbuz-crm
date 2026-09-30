// Страница создания и редактирования публикации.
//
// Редактор специально живёт на странице, а не в модальном окне: его всплывающие слои
// (выбор стиля блока, меню таблицы, диалоги ссылки и картинки) портируются в body
// с z-index ниже оверлея модалки и оказывались бы под ним.
import { lazy, Suspense, useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { PostStatuses } from '../../lib/post-status';
import {
  Badge,
  Button,
  Checkbox,
  Container,
  DatePicker,
  DragDrop,
  Icon,
  Input,
  StateMessage,
  useToast,
} from '../../components/ui';
import type { IconName } from '../../components/ui';
import { postsApi, type Post, type PostFile, type PostPayload } from '../../api/posts';
import { ApiError } from '../../api/client';
import styles from './PostEditorPage.module.css';

// Тяжёлый WYSIWYG-редактор грузим отдельным чанком только при работе с публикацией.
// Импорт по файлу (а не по index) — чтобы чанк получил понятное имя `MarkdownEditor`.
const MarkdownEditor = lazy(() =>
  import('../../components/ui/MarkdownEditor/MarkdownEditor').then((module) => ({ default: module.MarkdownEditor })),
);

const LIST_PATH = '/admin/posts';

/** Режим публикации: черновик / сразу / отложенно. */
const PUBLISH_MODE = { draft: 'draft', now: 'now', scheduled: 'scheduled' } as const;
type PublishMode = (typeof PUBLISH_MODE)[keyof typeof PUBLISH_MODE];

/** Кнопки режима публикации: иконка + подпись (вместо выпадающего списка). */
const PUBLISH_MODE_BUTTONS: readonly { value: PublishMode; label: string; icon: IconName }[] = [
  { value: PUBLISH_MODE.draft, label: 'Черновик', icon: 'drag' },
  { value: PUBLISH_MODE.now, label: 'Опубликовать сейчас', icon: 'check' },
  { value: PUBLISH_MODE.scheduled, label: 'Запланировать', icon: 'clock' },
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

/** Уже прикреплённые к публикации файлы (для сохранённой публикации). */
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
          <Button
            size="sm"
            variant="ghost"
            icon="delete"
            aria-label="Удалить вложение"
            onClick={() => void handleRemove(file.id)}
          />
        </span>
      ))}
    </div>
  );
}

export function PostEditorPage() {
  const { postId: postIdParam } = useParams<{ postId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();

  const numericId = postIdParam === undefined ? null : Number(postIdParam);
  const invalidId = numericId !== null && (!Number.isInteger(numericId) || numericId <= 0);

  // Публикация создаётся при первой необходимости: файлы (вложения и картинки в тексте)
  // привязываются к уже существующей публикации.
  const [postId, setPostId] = useState<number | null>(invalidId ? null : numericId);
  const [archived, setArchived] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [mode, setMode] = useState<PublishMode>(
    searchParams.get('mode') === PUBLISH_MODE.scheduled ? PUBLISH_MODE.scheduled : PUBLISH_MODE.draft,
  );
  const [scheduledDate, setScheduledDate] = useState('');
  const [hideAuthor, setHideAuthor] = useState(false);
  const [pinned, setPinned] = useState(false);
  // Порядок здесь не редактируется (настраивается перетаскиванием в списке),
  // но должен сохраняться при прочих правках — храним в ref без ререндера.
  const sortOrderRef = useRef(0);
  // Файлы, выбранные до сохранения: загружаем их после сохранения публикации.
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(numericId !== null && !invalidId);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const createdRef = useRef(false);

  const applyPost = useCallback((post: Post) => {
    setPostId(post.id);
    setTitle(post.title);
    setContent(post.content);
    setHideAuthor(post.hideAuthor);
    setPinned(post.pinned);
    sortOrderRef.current = post.sortOrder;
    setArchived(post.status === PostStatuses.archived);
    setMode(
      post.status === PostStatuses.scheduled
        ? PUBLISH_MODE.scheduled
        : post.status === PostStatuses.draft
          ? PUBLISH_MODE.draft
          : PUBLISH_MODE.now,
    );
    setScheduledDate(isoToDateInput(post.scheduledAt));
  }, []);

  useEffect(() => {
    if (numericId === null) return undefined;
    if (invalidId) {
      setError('Некорректный идентификатор публикации');
      setLoading(false);
      return undefined;
    }
    let cancelled = false;
    setLoading(true);
    postsApi
      .get(numericId)
      .then(({ post }) => {
        if (!cancelled) applyPost(post);
      })
      .catch((caught) => {
        if (!cancelled) setError(caught instanceof ApiError ? caught.message : 'Не удалось загрузить публикацию');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [numericId, invalidId, applyPost]);

  /** Текущие значения формы в виде payload. */
  const formPayload = (): PostPayload => ({
    title: title.trim(),
    content,
    is_published: mode !== PUBLISH_MODE.draft,
    hide_author: hideAuthor,
    scheduled_at: mode === PUBLISH_MODE.scheduled ? dateInputToIso(scheduledDate) : null,
    // Архив — отдельное действие в списке: при правке статус архива сохраняем.
    archived,
    pinned,
    // Порядок меняется drag-&-drop в общем списке — здесь сохраняем текущее значение.
    sort_order: sortOrderRef.current,
  });

  /** Создаёт публикацию, если её ещё нет (иначе загружать файлы некуда). */
  const ensurePost = async (): Promise<number> => {
    if (postId !== null) return postId;
    if (!title.trim()) {
      toast.showToast({ message: 'Сначала укажите заголовок публикации', tone: 'error' });
      throw new Error('Укажите заголовок публикации — без него нельзя загрузить файл');
    }
    const response = await postsApi.create(formPayload());
    setPostId(response.post.id);
    createdRef.current = true;
    return response.post.id;
  };

  /** Загрузка картинки, вставленной прямо в текст: возвращает адрес для `src`. */
  const uploadImage = async (file: File): Promise<string> => {
    const id = await ensurePost();
    const response = await postsApi.files.upload(id, file);
    return postsApi.files.downloadUrl(id, response.file.id);
  };

  /** Сохранение: `exit` — вернуться к списку после успеха. */
  const handleSave = async (exit: boolean) => {
    setError(null);
    if (mode === PUBLISH_MODE.scheduled && !scheduledDate) {
      setError('Выберите дату отложенной публикации');
      return;
    }
    setSaving(true);
    try {
      // Сначала создаём (если ещё нет), затем обновляем — повторное сохранение не делает дубликат.
      const id = await ensurePost();
      await postsApi.update(id, formPayload());

      const uploadedCount = pendingFiles.length;
      for (const file of pendingFiles) {
        await postsApi.files.upload(id, file);
      }
      setPendingFiles([]);
      createdRef.current = false;
      toast.showToast({
        message: uploadedCount > 0 ? 'Публикация сохранена, вложения загружены' : 'Публикация сохранена',
        tone: 'success',
      });

      if (exit) {
        navigate(LIST_PATH);
        return;
      }
      if (postId === null) {
        // Заменяем адрес, чтобы обновление страницы открывало уже созданную публикацию.
        navigate(`${LIST_PATH}/${id}`, { replace: true });
        return;
      }
      const { post } = await postsApi.get(id);
      applyPost(post);
    } catch (caught) {
      setError(caught instanceof ApiError || caught instanceof Error ? caught.message : 'Не удалось сохранить публикацию');
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    void handleSave(false);
  };

  /** Возврат к списку: если публикацию успели создать, обновляем её состояние на сервере. */
  const handleBack = () => {
    if (createdRef.current && postId !== null) {
      createdRef.current = false;
      void postsApi
        .update(postId, formPayload())
        .catch(() => undefined)
        .finally(() => navigate(LIST_PATH));
      return;
    }
    navigate(LIST_PATH);
  };

  if (loading) return <StateMessage state="loading" />;
  if (error && postId === null) {
    return <StateMessage state="error" message={error} onRetry={() => navigate(LIST_PATH)} />;
  }

  return (
    <Container
      title={postId === null ? 'Новая публикация' : 'Редактирование публикации'}
      actions={
        <>
          <Button variant="secondary" icon="arrow-left" onClick={handleBack} disabled={saving}>
            К списку
          </Button>
          <Button variant="secondary" icon="check" loading={saving} onClick={() => void handleSave(false)}>
            Сохранить
          </Button>
          <Button icon="success" loading={saving} onClick={() => void handleSave(true)}>
            Сохранить и выйти
          </Button>
        </>
      }
    >
      <form className={styles.form} onSubmit={handleSubmit}>
        <Input label="Заголовок" value={title} onChange={(e) => setTitle(e.target.value)} required fullWidth />

        <div className={styles.formRow}>
          {archived ? (
            <p className={styles.note}>
              Публикация в архиве: её не видно в ленте. Вернуть — кнопкой «Из архива» в списке.
            </p>
          ) : (
            <div className={styles.modeButtons} role="group" aria-label="Режим публикации">
              {PUBLISH_MODE_BUTTONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={[styles.modeButton, mode === option.value ? styles.modeButtonActive : '']
                    .filter(Boolean)
                    .join(' ')}
                  aria-pressed={mode === option.value}
                  onClick={() => setMode(option.value)}
                >
                  <Icon name={option.icon} size={16} />
                  {option.label}
                </button>
              ))}
            </div>
          )}
        </div>
        {!archived && mode === PUBLISH_MODE.scheduled ? (
          <DatePicker label="Дата выхода" value={scheduledDate} onChange={setScheduledDate} min={tomorrowInputValue()} />
        ) : null}

        <div className={styles.formFlags}>
          <Checkbox label="Скрыть автора в ленте" checked={hideAuthor} onChange={setHideAuthor} />
          <Checkbox label="Закрепить в ленте" checked={pinned} onChange={setPinned} />
        </div>
        <p className={styles.note}>
          Порядок публикаций настраивается перетаскиванием в общем списке «Публикации».
        </p>

        <div className={styles.editorWrap}>
          <span className={styles.sectionLabel}>Содержание публикации</span>
          <p className={styles.note}>
            Вставьте подряд несколько изображений — в ленте они покажутся каруселью с листанием.
          </p>
          <Suspense fallback={<StateMessage state="loading" />}>
            <MarkdownEditor
              markdown={content}
              onChange={setContent}
              uploadImage={uploadImage}
              placeholder="Начните печатать текст публикации…"
            />
          </Suspense>
        </div>

        <div className={styles.attachments}>
          <span className={styles.sectionLabel}>Вложения для скачивания</span>
          <p className={styles.note}>
            Файлы из этого блока показываются в ленте кликабельным названием. Картинки, вставленные в текст
            кнопкой «Вставить изображение», отображаются прямо в публикации и здесь не дублируются.
          </p>
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
          {postId !== null ? <AttachmentsList postId={postId} /> : null}
        </div>

        {error ? <div className={styles.error}>{error}</div> : null}
      </form>
    </Container>
  );
}
