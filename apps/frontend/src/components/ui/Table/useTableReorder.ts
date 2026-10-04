import { useCallback, useEffect, useRef, useState } from 'react';
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react';

export type TableReorderOptions<T> = {
  items: T[];
  /** Числовой id строки — то, что уходит в onReorder. */
  id: (item: T) => number;
  /** Строки разных групп не пересекаются (например pinned true/false). */
  groupKey?: (item: T) => string | number;
  /** Вызывается после drop, если позиция изменилась. */
  onReorder: (draggedId: number, targetId: number) => void;
  /** CSS-классы строк для визуала (из module.css хост-страницы). */
  classNames?: { dragging?: string; shifting?: string };
};

export type TableReorderApi<T> = {
  isDragging: boolean;
  getHandleProps: (
    item: T,
    index: number,
  ) => {
    onPointerDown: (event: ReactPointerEvent<HTMLElement>) => void;
  };
  getRowStyle: (item: T, index: number) => CSSProperties | undefined;
  getRowClassName: (item: T, index: number) => string | undefined;
  isDraggedItem: (item: T) => boolean;
};

type DragInfo = {
  id: number;
  startIndex: number;
  groupIndices: number[];
  groupPosition: number;
  startY: number;
  rowHeight: number;
};

/**
 * Pointer-based reorder строк таблицы.
 * Отдаёт пропсы для ручки (`getHandleProps`) и inline-стили/классы для `<tr>`.
 */
export function useTableReorder<T>(options: TableReorderOptions<T>): TableReorderApi<T> {
  const { items, id, groupKey, onReorder, classNames } = options;

  const infoRef = useRef<DragInfo | null>(null);
  const [active, setActive] = useState(false);
  const [visual, setVisual] = useState<{
    id: number;
    deltaY: number;
    targetIndex: number;
  } | null>(null);

  const getHandleProps = useCallback(
    (item: T, index: number) => ({
      onPointerDown: (event: ReactPointerEvent<HTMLElement>) => {
        if (event.button !== 0) return;
        const row = (event.currentTarget as HTMLElement).closest('tr') as HTMLTableRowElement | null;
        if (!row) return;
        event.preventDefault();
        window.getSelection()?.removeAllRanges();

        const key = groupKey?.(item);
        const groupIndices: number[] = [];
        items.forEach((it, i) => {
          if (key === undefined || groupKey?.(it) === key) groupIndices.push(i);
        });

        infoRef.current = {
          id: id(item),
          startIndex: index,
          groupIndices,
          groupPosition: groupIndices.indexOf(index),
          startY: event.clientY,
          rowHeight: row.getBoundingClientRect().height,
        };
        setActive(true);
        setVisual({ id: id(item), deltaY: 0, targetIndex: index });
      },
    }),
    [items, id, groupKey],
  );

  useEffect(() => {
    if (!active) return;

    const computeTarget = (info: DragInfo, deltaY: number) => {
      const offset = Math.round(deltaY / info.rowHeight);
      const pos = Math.max(
        0,
        Math.min(info.groupIndices.length - 1, info.groupPosition + offset),
      );
      return info.groupIndices[pos];
    };

    const onMove = (event: PointerEvent) => {
      const info = infoRef.current;
      if (!info) return;
      const deltaY = event.clientY - info.startY;
      setVisual({ id: info.id, deltaY, targetIndex: computeTarget(info, deltaY) });
    };

    const finish = (event: PointerEvent | null) => {
      const info = infoRef.current;
      infoRef.current = null;
      setActive(false);
      setVisual(null);
      if (!info || !event) return;
      const target = computeTarget(info, event.clientY - info.startY);
      if (target !== info.startIndex) {
        const targetItem = items[target];
        if (targetItem) onReorder(info.id, id(targetItem));
      }
    };

    const onUp = (event: PointerEvent) => finish(event);
    const onCancel = () => finish(null);

    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'grabbing';
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onCancel);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onCancel);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };
  }, [active, items, id, onReorder]);

  const getRowStyle = useCallback(
    (item: T, index: number): CSSProperties | undefined => {
      const info = infoRef.current;
      if (!visual || !info) return undefined;
      if (id(item) === visual.id) {
        return { transform: `translateY(${visual.deltaY}px)`, zIndex: 20 };
      }
      const from = info.startIndex;
      const to = visual.targetIndex;
      let shift = 0;
      if (from < to && index > from && index <= to) shift = -1;
      else if (from > to && index >= to && index < from) shift = 1;
      if (!shift) return undefined;
      return { transform: `translateY(${shift * info.rowHeight}px)` };
    },
    [visual, id],
  );

  const getRowClassName = useCallback(
    (item: T): string | undefined => {
      if (!visual) return undefined;
      return id(item) === visual.id ? classNames?.dragging : classNames?.shifting;
    },
    [visual, id, classNames],
  );

  const isDraggedItem = useCallback(
    (item: T) => visual !== null && id(item) === visual.id,
    [visual, id],
  );

  return { isDragging: active, getHandleProps, getRowStyle, getRowClassName, isDraggedItem };
}
