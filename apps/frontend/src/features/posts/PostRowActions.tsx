import { PostStatuses } from '../../lib/post-status';
import type { Post, PostPayload } from '../../api/posts';
import type { RowActionItem } from '../../components/ui';

type Handlers = {
  onEdit: (post: Post) => void;
  onTogglePin: (post: Post) => void;
  onCopyLink: (post: Post) => void;
  onPublishNow: (post: Post) => void;
  onApplyChange: (post: Post, override: Partial<PostPayload>, message: string) => void;
  onDelete: (post: Post) => void;
  onMove: (post: Post, direction: 'up' | 'down') => void;
  canMove: (post: Post, direction: 'up' | 'down') => boolean;
  busy: boolean;
};

/** Собирает RowActionItem[] для строки: 3 иконки + пункты kebab. */
export function buildPostRowActions(post: Post, h: Handlers): RowActionItem[] {
  const isDraft = post.status === PostStatuses.draft;
  const isPublished = post.status === PostStatuses.published;
  const isArchived = post.status === PostStatuses.archived;

  return [
    // --- primary (иконки в строке) ---
    {
      key: 'edit',
      label: 'Изменить',
      icon: 'edit',
      placement: 'primary',
      disabled: h.busy,
      title: 'Открыть редактор публикации',
      onSelect: () => h.onEdit(post),
    },
    {
      key: 'pin',
      label: post.pinned ? 'Открепить' : 'Закрепить',
      icon: 'pin',
      placement: 'primary',
      variant: post.pinned ? 'primary' : 'secondary',
      disabled: h.busy,
      title: post.pinned ? 'Открепить от верха ленты' : 'Закрепить наверху ленты',
      onSelect: () => h.onTogglePin(post),
    },
    {
      key: 'copy',
      label: 'Копировать ссылку',
      icon: 'chain',
      placement: 'primary',
      disabled: h.busy,
      title: 'Скопировать ссылку на публикацию',
      onSelect: () => h.onCopyLink(post),
    },

    // --- menu (только в kebab) ---
    {
      key: 'publish',
      label: 'Опубликовать сейчас',
      icon: 'check',
      placement: 'menu',
      disabled: h.busy || isPublished || isArchived,
      title: isPublished || isArchived ? 'Публикация уже в ленте' : 'Опубликовать сейчас',
      onSelect: () => h.onPublishNow(post),
    },
    {
      key: 'move-up',
      label: 'Переместить вверх',
      icon: 'arrow-up',
      placement: 'menu',
      disabled: h.busy || !h.canMove(post, 'up'),
      title: h.canMove(post, 'up') ? 'Поднять на одну позицию' : 'Уже в начале списка',
      onSelect: () => h.onMove(post, 'up'),
    },
    {
      key: 'move-down',
      label: 'Переместить вниз',
      icon: 'arrow-down',
      placement: 'menu',
      disabled: h.busy || !h.canMove(post, 'down'),
      title: h.canMove(post, 'down') ? 'Опустить на одну позицию' : 'Уже в конце списка',
      onSelect: () => h.onMove(post, 'down'),
    },
    isArchived
      ? {
          key: 'restore',
          label: 'Из архива',
          icon: 'undo',
          placement: 'menu',
          disabled: h.busy,
          title: 'Вернуть публикацию в ленту',
          onSelect: () => h.onApplyChange(post, { archived: false }, 'Публикация возвращена из архива'),
        }
      : {
          key: 'archive',
          label: 'Заархивировать',
          icon: 'briefcase',
          placement: 'menu',
          disabled: h.busy,
          title: 'Скрыть публикацию с домашней страницы',
          onSelect: () => h.onApplyChange(post, { archived: true }, 'Публикация в архиве'),
        },
    {
      key: 'hide',
      label: 'Скрыть из ленты',
      icon: 'crossed-eye',
      placement: 'menu',
      disabled: h.busy || isDraft,
      title: isDraft ? 'Публикация уже скрыта (черновик)' : 'Скрыть публикацию из ленты',
      onSelect: () =>
        h.onApplyChange(post, { is_published: false, scheduled_at: null }, 'Публикация скрыта из ленты'),
    },
    {
      key: 'delete',
      label: 'Удалить',
      icon: 'delete',
      placement: 'menu',
      danger: true,
      disabled: h.busy,
      title: 'Удалить публикацию',
      onSelect: () => h.onDelete(post),
    },
  ];
}
