// Раздел «Публикации»: список со статусами, быстрыми действиями и drag-reorder.
// Создание и правка публикации — на отдельной странице (`/admin/posts/new`, `/admin/posts/:id`).
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Button,
  ConfirmDialog,
  Container,
  Icon,
  ListToolbar,
  Pagination,
  RowActions,
  SearchInput,
  Select,
  StateMessage,
  StatusBadge,
  Table,
  useTableReorder,
} from '../../components/ui';
import type { TableColumn } from '../../components/ui';
import { PostStatuses } from '../../lib/post-status';
import type { PostStatus } from '@arbuz/shared';
import type { Post } from '../../api/posts';
import { formatDateTime } from '../../lib/format';
import { POST_FILTER_OPTIONS, POST_STATUS_OPTIONS } from './posts-helpers';
import { buildPostRowActions } from './PostRowActions';
import { usePosts } from './usePosts';
import styles from './PostsPage.module.css';

const LIST_PATH = '/admin/posts';

export function PostsPage() {
  const navigate = useNavigate();
  const list = usePosts();
  const [deleting, setDeleting] = useState<Post | null>(null);

  const reorder = useTableReorder<Post>({
    items: list.posts,
    id: (post) => post.id,
    groupKey: (post) => (post.pinned ? 'pinned' : 'regular'),
    onReorder: (draggedId, targetId) => void list.reorder(draggedId, targetId),
    classNames: { dragging: styles.rowDragging, shifting: styles.rowShifting },
  });

  const columns: TableColumn<Post>[] = [
    {
      key: 'drag',
      header: '',
      width: '36px',
      render: (post, index) => (
        <span
          {...reorder.getHandleProps(post, index)}
          className={[
            styles.dragHandle,
            reorder.isDraggedItem(post) ? styles.dragHandleActive : '',
          ]
            .filter(Boolean)
            .join(' ')}
          role="button"
          tabIndex={0}
          title="Перетащите, чтобы изменить порядок"
          aria-label="Перетащите, чтобы изменить порядок"
          onKeyDown={(e) => {
            if (e.key === 'ArrowUp') {
              e.preventDefault();
              list.move(post, 'up');
            } else if (e.key === 'ArrowDown') {
              e.preventDefault();
              list.move(post, 'down');
            }
          }}
        >
          <Icon name="drag-vertical" size={16} />
        </span>
      ),
    },
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
      render: (post) => {
        const items = buildPostRowActions(post, {
          busy: list.busyId === post.id,
          canMove: list.canMove,
          onEdit: (p) => navigate(`${LIST_PATH}/${p.id}`),
          onTogglePin: (p) => void list.togglePin(p),
          onCopyLink: (p) => void list.copyLink(p),
          onPublishNow: (p) => void list.publishNow(p),
          onApplyChange: (p, override, msg) => void list.applyChange(p, override, msg),
          onDelete: (p) => setDeleting(p),
          onMove: (p, dir) => list.move(p, dir),
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
      <ListToolbar>
        <SearchInput
          placeholder="Поиск по заголовку"
          onChange={(value) => {
            list.setSearch(value);
            list.setPage(1);
          }}
        />
        <Select
          label="Статус"
          placeholder="Все публикации"
          value={list.statusFilter}
          onChange={(value) => {
            list.setStatusFilter(value as PostStatus | '');
            list.setPage(1);
          }}
          options={POST_FILTER_OPTIONS}
        />
      </ListToolbar>

      {list.loading ? (
        <StateMessage state="loading" />
      ) : list.error ? (
        <StateMessage state="error" message={list.error} onRetry={() => void list.load()} />
      ) : list.posts.length === 0 ? (
        <StateMessage state="empty" message="Публикаций пока нет" />
      ) : (
        <>
          <Table
            columns={columns}
            data={list.posts}
            rowKey={(post) => post.id}
            rowStyle={reorder.getRowStyle}
            rowClassName={reorder.getRowClassName}
            separateBorders
            sortable={false}
          />
          <Pagination
            page={list.page}
            pageSize={list.pageSize}
            total={list.total}
            onPageChange={list.setPage}
            onPageSizeChange={list.setPageSize}
            pageSizeOptions={list.PAGE_SIZE_OPTIONS}
          />
        </>
      )}

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
