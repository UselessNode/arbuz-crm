// Раздел «Публикации»: список со статусами, быстрыми действиями и drag-reorder.
// Создание и правка публикации — на отдельной странице (`/admin/posts/new`, `/admin/posts/:id`).
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Button,
  ConfirmDialog,
  Container,
  DataView,
  Icon,
  RowActions,
  StatusBadge,
  useDataViewState,
  useTableReorder,
} from '../../components/ui';
import type { FilterSpec, TableColumn } from '../../components/ui';
import { PostStatuses } from '../../lib/post-status';
import type { Post } from '../../api/posts';
import { postsApi } from '../../api/posts';
import { formatDateTime } from '../../lib/format';
import { POST_FILTER_OPTIONS, POST_STATUS_OPTIONS } from './posts-helpers';
import { buildPostRowActions } from './PostRowActions';
import { usePosts } from './usePosts';
import styles from './PostsPage.module.css';

const LIST_PATH = '/admin/posts';

export function PostsPage() {
  const navigate = useNavigate();
  const [deleting, setDeleting] = useState<Post | null>(null);

  const specs = useMemo<FilterSpec[]>(
    () => [
      {
        kind: 'multi-select',
        field: 'post',
        label: 'По публикации',
        placeholder: 'Заголовок…',
        loadOptions: async (search) => {
          const response = await postsApi.list({ search: search || undefined, limit: 20, offset: 0 });
          return response.posts.map((post) => ({ value: String(post.id), label: post.title }));
        },
      },
      {
        kind: 'checkbox-group',
        field: 'status',
        label: 'Статус публикации',
        options: POST_FILTER_OPTIONS.map((option) => ({ value: option.value, label: option.label })),
      },
      { kind: 'date-range', field: 'scheduled', label: 'Дата запланирования', presets: true },
      { kind: 'date-range', field: 'edited', label: 'Дата изменения', presets: true },
      { kind: 'date-range', field: 'created', label: 'Дата создания', presets: true },
    ],
    [],
  );

  const state = useDataViewState({ specs, defaultPageSize: 20 });
  const list = usePosts(state.query);

  // Порядок можно менять только в «естественном» виде — при активных фильтрах drag отключён.
  const reorderDisabled = state.hasActiveFilters;

  const reorder = useTableReorder<Post>({
    items: list.posts,
    id: (post) => post.id,
    groupKey: (post) => (post.pinned ? 'pinned' : 'regular'),
    onReorder: (draggedId, targetId) => void list.reorder(draggedId, targetId),
    classNames: { dragging: styles.rowDragging, shifting: styles.rowShifting },
  });

  const columns: TableColumn<Post>[] = [
    // Ручка перетаскивания — только когда фильтров нет (иначе порядок не имеет смысла).
    ...(reorderDisabled
      ? []
      : [
          {
            key: 'drag',
            header: '',
            width: '36px',
            sortable: false,
            render: (post: Post, index: number) =>
              post.pinned ? (
                // У закреплённых вместо ручки — булавка: клик снимает закрепление.
                <button
                  type="button"
                  className={`${styles.dragHandle} ${styles.pinButton}`}
                  title="Открепить публикацию"
                  aria-label="Открепить публикацию"
                  onClick={() => void list.togglePin(post)}
                >
                  <Icon name="pin" size={16} />
                </button>
              ) : (
                <span
                  {...reorder.getHandleProps(post, index)}
                  className={[styles.dragHandle, reorder.isDraggedItem(post) ? styles.dragHandleActive : '']
                    .filter(Boolean)
                    .join(' ')}
                  role="button"
                  tabIndex={0}
                  title="Перетащите, чтобы изменить порядок"
                  aria-label="Перетащите, чтобы изменить порядок"
                  onKeyDown={(event) => {
                    if (event.key === 'ArrowUp') {
                      event.preventDefault();
                      list.move(post, 'up');
                    } else if (event.key === 'ArrowDown') {
                      event.preventDefault();
                      list.move(post, 'down');
                    }
                  }}
                >
                  <Icon name="drag-vertical" size={16} />
                </span>
              ),
          } satisfies TableColumn<Post>,
        ]),
    {
      key: 'title',
      header: 'Публикация',
      render: (post) => (
        <div className={styles.cellMain}>
          <div className={styles.titleRow}>
            {post.pinned ? (
              <span className={styles.pinIcon} aria-hidden>
                <Icon name="pin" size={14} />
              </span>
            ) : null}
            <span className={styles.postTitle} title={post.title}>
              {post.title}
            </span>
          </div>
          <div className={styles.meta}>
            <span>{post.hideAuthor ? 'Автор скрыт' : post.authorName ?? '—'}</span>
            <span className={styles.metaDot} aria-hidden>
              ·
            </span>
            <span>{formatDateTime(post.createdAt)}</span>
            {post.status === PostStatuses.scheduled && post.scheduledAt ? (
              <>
                <span className={styles.metaDot} aria-hidden>
                  ·
                </span>
                <span className={styles.metaAccent}>Выйдет: {formatDateTime(post.scheduledAt)}</span>
              </>
            ) : null}
            {post.editedAt ? (
              <>
                <span className={styles.metaDot} aria-hidden>
                  ·
                </span>
                <span>Изменено: {formatDateTime(post.editedAt)}</span>
              </>
            ) : null}
          </div>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Статус',
      width: '160px',
      render: (post) => <StatusBadge value={post.status} options={POST_STATUS_OPTIONS} />,
    },
    {
      key: 'actions',
      header: '',
      width: '150px',
      sortable: false,
      render: (post) => {
        const items = buildPostRowActions(post, {
          busy: list.busyId === post.id,
          canMove: reorderDisabled ? () => false : list.canMove,
          onEdit: (target) => navigate(`${LIST_PATH}/${target.id}`),
          onTogglePin: (target) => void list.togglePin(target),
          onCopyLink: (target) => void list.copyLink(target),
          onPublishNow: (target) => void list.publishNow(target),
          onApplyChange: (target, override, message) => void list.applyChange(target, override, message),
          onDelete: (target) => setDeleting(target),
          onMove: (target, direction) => list.move(target, direction),
        });
        return <RowActions ariaLabel="Действия с публикацией" items={items} />;
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
      <DataView
        state={state}
        mode="advanced"
        search={{ placeholder: 'Поиск по заголовку' }}
        columns={columns}
        rows={list.posts}
        rowKey={(post) => post.id}
        total={list.total}
        loading={list.loading}
        error={list.error}
        onRetry={() => void list.load()}
        sortable={false}
        separateBorders
        reorder={reorder}
        reorderDisabled={reorderDisabled}
        emptyText="Публикаций пока нет"
        noResultsText="Ничего не найдено"
      />

      <ConfirmDialog
        open={deleting !== null}
        title="Удаление публикации"
        message={`Удалить публикацию «${deleting?.title ?? ''}»?`}
        confirmLabel="Удалить"
        danger
        loading={list.busyId === deleting?.id}
        onConfirm={() => {
          if (deleting) {
            void list.remove(deleting);
            setDeleting(null);
          }
        }}
        onClose={() => setDeleting(null)}
      />
    </Container>
  );
}
