// Раздел «Публикации»: список со статусами и быстрыми действиями.
// Создание и правка публикации — на отдельной странице (`/admin/posts/new`, `/admin/posts/:id`):
// редактору нужна полная ширина и свободные всплывающие слои (см. `PostEditorPage`).
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Badge,
  Button,
  ConfirmDialog,
  Container,
  ListToolbar,
  Pagination,
  SearchInput,
  Select,
  StateMessage,
  StatusBadge,
  Table,
  useToast,
} from '../../components/ui';
import type { SelectOption, StatusOption, TableColumn } from '../../components/ui';
import { PostStatuses } from '../../lib/post-status';
import type { PostStatus } from '@arbuz/shared';
import { postsApi, type Post, type PostPayload } from '../../api/posts';
import { ApiError } from '../../api/client';
import { formatDateTime } from '../../lib/format';
import styles from './PostsPage.module.css';

const PAGE_SIZE_OPTIONS = [20, 50, 100] as const;

/** Базовый путь раздела: список и страница публикации. */
const LIST_PATH = '/admin/posts';

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

export function PostsPage() {
  const toast = useToast();
  const navigate = useNavigate();
  const [posts, setPosts] = useState<Post[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(PAGE_SIZE_OPTIONS[0]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<PostStatus | ''>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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
    {
      key: 'created',
      header: 'Создана',
      render: (post) => formatDateTime(post.createdAt),
    },
    {
      key: 'actions',
      header: '',
      width: '320px',
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
                    onClick={() => navigate(`${LIST_PATH}/${post.id}?mode=scheduled`)}
                  >
                    Запланировать
                  </Button>
                ) : null}
              </>
            )}
            <Button
              size="sm"
              variant="ghost"
              icon="edit"
              aria-label="Изменить"
              disabled={busy}
              onClick={() => navigate(`${LIST_PATH}/${post.id}`)}
            />
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
        <Button icon="add" onClick={() => navigate(`${LIST_PATH}/new`)}>
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
