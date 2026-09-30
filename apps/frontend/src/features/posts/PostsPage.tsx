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
  Icon,
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
import { copyToClipboard } from '../../lib/clipboard';
import styles from './PostsPage.module.css';

const PAGE_SIZE_OPTIONS = [20, 50, 100] as const;

/** HTML5 drag-and-drop: тип перемещаемой строки. */
const DRAG_MIME = 'application/x-arbuz-post';

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
    pinned: post.pinned,
    sort_order: post.sortOrder,
    ...override,
  };
}

/**
 * Порядок строк совпадает с серверным: закреплённые первыми, затем по ручному порядку,
 * при равенстве — новые выше. Применяем локально, чтобы строки вставали на место сразу.
 */
function sortPosts(list: Post[]): Post[] {
  return [...list].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}

/**
 * Порядок после перетаскивания: закреплённые всегда впереди незакреплённых,
 * внутри каждой группы — новый порядок (sort_order = индекс).
 * Возвращает только те публикации, у которых порядок изменился.
 */
export function reorderForDrop(list: Post[], draggedId: number, targetId: number): Array<{ id: number; sortOrder: number }> {
  const dragged = list.find((post) => post.id === draggedId);
  const target = list.find((post) => post.id === targetId);
  if (!dragged || !target || dragged.id === target.id) return [];
  // Закреплённые и незакреплённые — независимые группы: между ними не переносим.
  if (dragged.pinned !== target.pinned) return [];

  const group = list.filter((post) => post.pinned === dragged.pinned);
  const from = group.findIndex((post) => post.id === draggedId);
  const to = group.findIndex((post) => post.id === targetId);
  if (from === -1 || to === -1) return [];

  const next = [...group];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);

  const changes: Array<{ id: number; sortOrder: number }> = [];
  next.forEach((post, index) => {
    if (post.sortOrder !== index) changes.push({ id: post.id, sortOrder: index });
  });
  return changes;
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

  /**
   * Переключение закрепления: строка сразу встаёт на своё место в списке
   * (закреплённые — наверху, далее по порядку).
   */
  const togglePin = async (post: Post) => {
    setError(null);
    setBusyId(post.id);
    try {
      const response = await postsApi.update(post.id, buildPayload(post, { pinned: !post.pinned }));
      setPosts((prev) => sortPosts(prev.map((item) => (item.id === response.post.id ? response.post : item))));
      toast.showToast({
        message: response.post.pinned ? 'Публикация закреплена наверху' : 'Публикация откреплена',
        tone: 'success',
      });
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Не удалось изменить публикацию');
      await load();
    } finally {
      setBusyId(null);
    }
  };

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

  const copyLink = async (post: Post) => {
    const copied = await copyToClipboard(`${window.location.origin}/#post-${post.id}`);
    toast.showToast({
      message: copied ? 'Ссылка на публикацию скопирована' : 'Не удалось скопировать',
      tone: copied ? 'success' : 'error',
    });
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

  /**
   * Кнопки-иконки в строке: изменить и закрепить (плюс — скопировать ссылку).
   * Остальные действия (опубликовать, архив, скрыть, удалить) — в kebab-меню.
   */
  const buildPrimaryActions = (post: Post): RowAction[] => {
    const busy = busyId === post.id;
    return [
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
        key: 'pin',
        label: post.pinned ? 'Открепить' : 'Закрепить',
        icon: 'pin',
        variant: post.pinned ? 'primary' : 'secondary',
        disabled: busy,
        title: post.pinned ? 'Открепить от верха ленты' : 'Закрепить наверху ленты',
        onSelect: () => void togglePin(post),
      },
      {
        key: 'copy',
        label: 'Копировать ссылку',
        icon: 'link',
        variant: 'secondary',
        disabled: busy,
        title: 'Скопировать ссылку на публикацию',
        onSelect: () => void copyLink(post),
      },
    ];
  };

  /** Действия kebab-меню: публикация/архив/скрытие и удаление. */
  const buildMenuActions = (post: Post): RowAction[] => {
    const busy = busyId === post.id;
    const isDraft = post.status === PostStatuses.draft;
    const isPublished = post.status === PostStatuses.published;
    const isArchived = post.status === PostStatuses.archived;
    const actions: RowAction[] = [
      {
        key: 'publish',
        label: 'Опубликовать сейчас',
        icon: 'check',
        variant: 'secondary',
        disabled: busy || isPublished || isArchived,
        title: isPublished || isArchived ? 'Публикация уже в ленте' : 'Опубликовать сейчас',
        onSelect: () => void publishNow(post),
      },
    ];
    if (isArchived) {
      actions.push({
        key: 'restore',
        label: 'Из архива',
        icon: 'undo',
        variant: 'secondary',
        disabled: busy,
        title: 'Вернуть публикацию в ленту',
        onSelect: () => void applyChange(post, { archived: false }, 'Публикация возвращена из архива'),
      });
    } else {
      actions.push({
        key: 'archive',
        label: 'Заархивировать',
        icon: 'briefcase',
        variant: 'secondary',
        disabled: busy,
        title: 'Скрыть публикацию с домашней страницы',
        onSelect: () => void applyChange(post, { archived: true }, 'Публикация в архиве'),
      });
    }
    actions.push(
      {
        key: 'hide',
        label: 'Скрыть из ленты',
        icon: 'crossed-eye',
        variant: 'secondary',
        disabled: busy || isDraft,
        title: isDraft ? 'Публикация уже скрыта (черновик)' : 'Скрыть публикацию из ленты',
        onSelect: () => void applyChange(post, { is_published: false, scheduled_at: null }, 'Публикация скрыта из ленты'),
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
    );
    return actions;
  };

  /**
   * Перетаскивание строки на другую для смены порядка.
   * Закреплённые и незакреплённые — разные группы; после перестановки порядок
   * пересчитывается (sort_order = индекс) и отправляется пачкой.
   */
  const handleReorder = async (draggedId: number, targetId: number) => {
    const changes = reorderForDrop(posts, draggedId, targetId);
    if (changes.length === 0) return;
    const sortById = new Map(changes.map((change) => [change.id, change.sortOrder]));
    setError(null);
    // Оптимистично переставляем в UI.
    setPosts((prev) =>
      sortPosts(
        prev.map((item) => (sortById.has(item.id) ? { ...item, sortOrder: sortById.get(item.id)! } : item)),
      ),
    );
    try {
      for (const change of changes) {
        const post = posts.find((item) => item.id === change.id);
        if (!post) continue;
        await postsApi.update(post.id, buildPayload(post, { sort_order: change.sortOrder }));
      }
      toast.showToast({ message: 'Порядок публикаций обновлён', tone: 'success' });
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Не удалось сохранить порядок');
      await load();
    }
  };

  const columns: TableColumn<Post>[] = [
    {
      key: 'drag',
      header: '',
      width: '44px',
      render: (post) => (
        <span
          className={styles.dragHandle}
          draggable
          role="button"
          tabIndex={0}
          title="Перетащите, чтобы изменить порядок"
          aria-label="Перетащите, чтобы изменить порядок"
          onDragStart={(event) => {
            event.dataTransfer.setData(DRAG_MIME, String(post.id));
            event.dataTransfer.effectAllowed = 'move';
          }}
        >
          <Icon name="drag-vertical" size={18} />
        </span>
      ),
    },
    {
      key: 'title',
      header: 'Заголовок публикации',
      render: (post) => (
        <div
          className={styles.cellMain}
          onDragOver={(event) => {
            if (event.dataTransfer.types.includes(DRAG_MIME)) event.preventDefault();
          }}
          onDrop={(event) => {
            const draggedId = Number(event.dataTransfer.getData(DRAG_MIME));
            if (!draggedId || draggedId === post.id) return;
            event.preventDefault();
            void handleReorder(draggedId, post.id);
          }}
        >
          <div className={styles.titleRow}>
            <span className={styles.postTitle}>{post.title}</span>
            {post.pinned ? <Icon name="pin" size={14} /> : null}
          </div>
          {post.pinned ? <span className={styles.note}>Закреплено · порядок {post.sortOrder}</span> : null}
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
      width: '180px',
      render: (post) => {
        const primary = buildPrimaryActions(post);
        const menu = buildMenuActions(post);

        if (isMobile) {
          return (
            <div className={styles.actionsMobile}>
              <KebabMenu
                label="Действия с публикацией"
                items={[...primary, ...menu].map((action) => ({
                  key: action.key,
                  label: action.label,
                  icon: action.icon,
                  disabled: action.disabled,
                  danger: action.variant === 'danger',
                  onSelect: action.onSelect,
                }))}
              />
            </div>
          );
        }

        return (
          <div className={styles.actionsIcons} role="group" aria-label="Действия с публикацией">
            {primary.map((action) => (
              <Button
                key={action.key}
                size="sm"
                variant={action.variant}
                icon={action.icon}
                disabled={action.disabled}
                title={action.title}
                aria-label={action.label}
                onClick={action.onSelect}
              />
            ))}
            <KebabMenu
              label="Ещё действия"
              items={menu.map((action) => ({
                key: action.key,
                label: action.label,
                icon: action.icon,
                disabled: action.disabled,
                danger: action.variant === 'danger',
                onSelect: action.onSelect,
              }))}
            />
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
