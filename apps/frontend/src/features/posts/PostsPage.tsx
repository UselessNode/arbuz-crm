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
  KebabMenu,
  ListToolbar,
  Pagination,
  SearchInput,
  Select,
  StateMessage,
  StatusBadge,
  Table,
  useToast,
} from '../../components/ui';
import type {
  ButtonVariant,
  IconName,
  SelectOption,
  StatusOption,
  TableColumn,
} from '../../components/ui';
import { PostStatuses } from '../../lib/post-status';
import type { PostStatus } from '@arbuz/shared';
import { postsApi, type Post, type PostPayload } from '../../api/posts';
import { ApiError } from '../../api/client';
import { formatDateTime } from '../../lib/format';
import styles from './PostsPage.module.css';

const PAGE_SIZE_OPTIONS = [20, 50, 100] as const;

/** Базовый путь раздела: список и страница публикации. */
const LIST_PATH = '/admin/posts';

/** Точка переключения на мобильную раскладку действий. */
const MOBILE_BREAKPOINT = 768;

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

/**
 * Описание быстрого действия над публикацией.
 * Один и тот же список используется для сетки кнопок и для kebab-меню.
 */
type RowAction = {
  key: string;
  label: string;
  icon: IconName;
  variant: ButtonVariant;
  disabled: boolean;
  title?: string;
  onSelect: () => void;
};

/**
 * Отслеживает мобильный вьюпорт, чтобы не рендерить одновременно
 * сетку кнопок и kebab-меню (иначе действия дублировались бы в DOM).
 */
function useIsMobile(breakpoint: number = MOBILE_BREAKPOINT): boolean {
  const query = `(max-width: ${breakpoint - 1}px)`;
  const [isMobile, setIsMobile] = useState<boolean>(() =>
    typeof window === 'undefined' ? false : window.matchMedia(query).matches,
  );

  useEffect(() => {
    const mql = window.matchMedia(query);
    const handle = (event: MediaQueryListEvent) => setIsMobile(event.matches);
    mql.addEventListener('change', handle);
    return () => mql.removeEventListener('change', handle);
  }, [query]);

  return isMobile;
}

export function PostsPage() {
  const toast = useToast();
  const navigate = useNavigate();
  const isMobile = useIsMobile();

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

  /**
   * Фиксированный набор из 4 действий — раскладка 2×2 на десктопе:
   *   [Опубликовать] [Запланировать | В архив | Из архива]
   *   [Изменить]     [Удалить]
   * Недоступные для текущего статуса кнопки остаются в разметке, но `disabled`.
   */
  const buildRowActions = (post: Post): RowAction[] => {
    const busy = busyId === post.id;
    const isDraft = post.status === PostStatuses.draft;
    const isPublished = post.status === PostStatuses.published;
    const isArchived = post.status === PostStatuses.archived;

    const publish: RowAction = {
      key: 'publish',
      label: 'Опубликовать',
      icon: 'check',
      variant: 'primary',
      disabled: busy || isPublished || isArchived,
      title: isPublished || isArchived ? 'Публикация уже в ленте' : 'Опубликовать сейчас',
      onSelect: () => void publishNow(post),
    };

    let secondary: RowAction;
    if (isArchived) {
      secondary = {
        key: 'restore',
        label: 'Из архива',
        icon: 'undo',
        variant: 'secondary',
        disabled: busy,
        title: 'Вернуть публикацию в ленту',
        onSelect: () => void applyChange(post, { archived: false }, 'Публикация возвращена из архива'),
      };
    } else if (isPublished) {
      secondary = {
        key: 'archive',
        label: 'В архив',
        icon: 'archive',
        variant: 'secondary',
        disabled: busy,
        title: 'Скрыть публикацию с домашней страницы',
        onSelect: () => void applyChange(post, { archived: true }, 'Публикация в архиве'),
      };
    } else {
      secondary = {
        key: 'schedule',
        label: 'Запланировать',
        icon: 'calendar',
        variant: 'secondary',
        // Планировать можно только черновик: у запланированной дата уже стоит.
        disabled: busy || !isDraft,
        title: isDraft ? 'Выбрать дату выхода' : 'Публикация уже запланирована',
        onSelect: () => navigate(`${LIST_PATH}/${post.id}?mode=scheduled`),
      };
    }

    return [
      publish,
      secondary,
      {
        key: 'edit',
        label: 'Изменить',
        icon: 'edit',
        variant: 'secondary',
        disabled: busy,
        title: 'Открыть редактор публикации',
        onSelect: () => navigate(`${LIST_PATH}/${post.id}`),
      },
      {
        key: 'delete',
        label: 'Удалить',
        icon: 'delete',
        variant: 'danger',
        disabled: busy,
        title: 'Удалить публикацию',
        onSelect: () => setDeleting(post),
      },
    ];
  };

  const columns: TableColumn<Post>[] = [
    {
      key: 'title',
      header: 'Заголовок публикации',
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
      header: 'Дата',
      render: (post) => formatDateTime(post.createdAt),
    },
    {
      key: 'actions',
      header: '',
      width: '320px',
      render: (post) => {
        const actions = buildRowActions(post);

        if (isMobile) {
          return (
            <div className={styles.actionsMobile}>
              <KebabMenu
                label="Действия с публикацией"
                items={actions.map((action) => ({
                  key: action.key,
                  label: action.label,
                  icon: action.icon,
                  disabled: action.disabled,
                  // В меню нет «вариантов» — опасное действие помечаем флагом.
                  danger: action.variant === 'danger',
                  onSelect: action.onSelect,
                }))}
              />
            </div>
          );
        }

        return (
          <div className={styles.actions} role="group" aria-label="Действия с публикацией">
            {actions.map((action) => (
              <Button
                key={action.key}
                size="sm"
                variant={action.variant}
                icon={action.icon}
                disabled={action.disabled}
                title={action.title}
                onClick={action.onSelect}
              >
                {action.label}
              </Button>
            ))}
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
