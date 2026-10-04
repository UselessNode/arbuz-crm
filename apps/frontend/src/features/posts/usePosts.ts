import { useCallback, useEffect, useState } from 'react';
import type { PostStatus } from '@arbuz/shared';
import { postsApi, type Post, type PostPayload } from '../../api/posts';
import { ApiError } from '../../api/client';
import { useToast } from '../../components/ui';
import { copyToClipboard } from '../../lib/clipboard';
import { buildPostPayload, reorderForDrop, sortPosts } from './posts-helpers';

const PAGE_SIZE_OPTIONS = [20, 50, 100] as const;

export function usePosts() {
  const toast = useToast();

  const [posts, setPosts] = useState<Post[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(PAGE_SIZE_OPTIONS[0]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<PostStatus | ''>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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

  const replacePost = (post: Post) =>
    setPosts((prev) => prev.map((item) => (item.id === post.id ? post : item)));

  const togglePin = async (post: Post) => {
    setError(null);
    setBusyId(post.id);
    try {
      const response = await postsApi.update(post.id, buildPostPayload(post, { pinned: !post.pinned }));
      setPosts((prev) =>
        sortPosts(prev.map((item) => (item.id === response.post.id ? response.post : item))),
      );
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
      const response = await postsApi.update(post.id, buildPostPayload(post));
      replacePost(response.post);
      toast.showToast({ message: 'Изменение отменено', tone: 'info' });
    } catch {
      setError('Не удалось отменить изменение публикации');
      await load();
    }
  };

  const applyChange = async (post: Post, override: Partial<PostPayload>, success: string) => {
    setError(null);
    setBusyId(post.id);
    try {
      const response = await postsApi.update(post.id, buildPostPayload(post, override));
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

  const remove = async (post: Post) => {
    setBusyId(post.id);
    try {
      await postsApi.remove(post.id);
      toast.showToast({ message: 'Публикация удалена', tone: 'success' });
      await load();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Не удалось удалить публикацию');
    } finally {
      setBusyId(null);
    }
  };

  /** Перестановка пары (draggedId, targetId) → PATCH по каждому изменению sort_order. */
  const reorder = async (draggedId: number, targetId: number) => {
    const changes = reorderForDrop(posts, draggedId, targetId);
    if (changes.length === 0) return;
    const sortById = new Map(changes.map((c) => [c.id, c.sortOrder]));
    setError(null);
    setPosts((prev) =>
      sortPosts(
        prev.map((item) =>
          sortById.has(item.id) ? { ...item, sortOrder: sortById.get(item.id)! } : item,
        ),
      ),
    );
    try {
      for (const change of changes) {
        const post = posts.find((item) => item.id === change.id);
        if (!post) continue;
        await postsApi.update(post.id, buildPostPayload(post, { sort_order: change.sortOrder }));
      }
      toast.showToast({ message: 'Порядок публикаций обновлён', tone: 'success' });
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Не удалось сохранить порядок');
      await load();
    }
  };

  /** Сосед по группе для «Переместить вверх/вниз». */
  const neighbor = (post: Post, direction: 'up' | 'down'): Post | null => {
    const group = posts.filter((item) => item.pinned === post.pinned);
    const index = group.findIndex((item) => item.id === post.id);
    const target = direction === 'up' ? index - 1 : index + 1;
    if (index === -1 || target < 0 || target >= group.length) return null;
    return group[target];
  };

  const canMove = (post: Post, direction: 'up' | 'down') => neighbor(post, direction) !== null;
  const move = (post: Post, direction: 'up' | 'down') => {
    const target = neighbor(post, direction);
    if (target) void reorder(post.id, target.id);
  };

  return {
    // data
    posts, total, page, pageSize, search, statusFilter,
    loading, error, busyId,
    PAGE_SIZE_OPTIONS,
    // setters
    setPage, setPageSize, setSearch, setStatusFilter,
    // actions
    load, togglePin, applyChange, publishNow, copyLink, remove, reorder, move, canMove,
  };
}
