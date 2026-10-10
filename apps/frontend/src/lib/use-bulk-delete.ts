// Единая логика массового удаления для админских списков: набор выбранных id,
// диалог подтверждения паролем и вызов API. Страницы передают `selection` в DataView
// и рендерят возвращённый `dialog` рядом со списком — так поведение одинаково
// во всех разделах (экспертизы/заявки/пользователи/публикации).
//
// Хук дженерик по типу строки: `getKey` превращает строку в числовой id. `selection`
// совместим с `DataView`/`Table` (принимает саму строку, а не ключ).
import { useCallback, useMemo, useState } from 'react';
import { bulkDeleteApi, type BulkEntity } from '../api/bulk-delete';
import { ApiError } from '../api/client';
import { useToast } from '../components/ui';

export interface UseBulkDeleteOptions<T> {
  entity: BulkEntity;
  /** Название сущности для сообщения диалога и тоста. */
  entityLabel: string;
  /** Преобразует строку списка в её id. */
  getKey: (row: T) => number;
  /** Вызывается после успешного удаления — перезагрузить список. */
  onDeleted?: () => void | Promise<void>;
  /**
   * Внешний набор выбранных id (когда страница уже ведёт своё выделение, например для отчётов).
   * Если задан — хук не держит собственное состояние выбора.
   */
  externalSelected?: ReadonlySet<number>;
  /** Очистить внешнее выделение после успешного удаления. */
  onClearExternal?: () => void;
  /** Нельзя выбирать эту строку (например, самого себя). */
  isDisabled?: (row: T) => boolean;
}

export function useBulkDelete<T>({
  entity,
  entityLabel,
  getKey,
  onDeleted,
  externalSelected,
  onClearExternal,
  isDisabled,
}: UseBulkDeleteOptions<T>) {
  const toast = useToast();
  const [internalSelected, setInternalSelected] = useState<ReadonlySet<number>>(new Set());
  const selected = externalSelected ?? internalSelected;
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isSelected = useCallback((row: T) => selected.has(getKey(row)), [selected, getKey]);

  const isSelectable = useCallback((row: T) => !(isDisabled?.(row) ?? false), [isDisabled]);

  const toggle = useCallback(
    (row: T) => {
      if (isDisabled?.(row)) return;
      const key = getKey(row);
      setInternalSelected((prev) => {
        const next = new Set(prev);
        if (next.has(key)) next.delete(key);
        else next.add(key);
        return next;
      });
    },
    [getKey, isDisabled],
  );

  const selection = useMemo(
    () => ({ isSelected, onToggle: toggle, isSelectable }),
    [isSelected, toggle, isSelectable],
  );

  const openConfirm = useCallback(() => {
    setError(null);
    setConfirmOpen(true);
  }, []);

  const closeConfirm = useCallback(() => {
    if (loading) return;
    setConfirmOpen(false);
    setError(null);
  }, [loading]);

  const confirm = useCallback(
    async (password: string) => {
      const ids = [...selected];
      if (ids.length === 0) return;
      setLoading(true);
      setError(null);
      try {
        const result = await bulkDeleteApi.remove(entity, ids, password);
        setConfirmOpen(false);
        if (onClearExternal) onClearExternal();
        else setInternalSelected(new Set());
        toast.showToast({ message: `Удалено: ${result.deleted} из ${ids.length}`, tone: 'success' });
        await onDeleted?.();
      } catch (caught) {
        setError(caught instanceof ApiError ? caught.message : 'Не удалось выполнить удаление');
      } finally {
        setLoading(false);
      }
    },
    [selected, entity, toast, onDeleted, onClearExternal],
  );

  return {
    selectedCount: selected.size,
    selection,
    isSelected,
    openConfirm,
    /** Готовый узел диалога подтверждения — рендерить рядом со списком. */
    dialog: {
      open: confirmOpen,
      loading,
      error,
      entityLabel,
      count: selected.size,
      onConfirm: confirm,
      onClose: closeConfirm,
    },
  };
}
