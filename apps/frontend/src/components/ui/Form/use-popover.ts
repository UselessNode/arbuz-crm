// Поведение всплывающего слоя: открытие, позиционирование от поля, закрытие
// по клику вне и по Escape. Общее для выбора даты и выбора периода — чтобы
// не дублировать эту логику в каждом компоненте.
//
// Попап рендерится в портале (`position: fixed`), поэтому он не обрезается
// границами контейнеров с overflow (например, модального окна), а сторону
// (снизу/сверху) компонент выбирает сам по свободному месту.
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';

/** Отступ попапа от поля и от краёв окна (px). */
const GAP = 4;
const EDGE = 8;

export function usePopover() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const anchorRef = useRef<HTMLButtonElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [style, setStyle] = useState<CSSProperties>({ top: 0, left: 0, visibility: 'hidden' });

  const toggle = useCallback(() => setOpen((prev) => !prev), []);
  const close = useCallback(() => setOpen(false), []);

  useLayoutEffect(() => {
    if (!open) {
      setStyle({ top: 0, left: 0, visibility: 'hidden' });
      return undefined;
    }
    const place = () => {
      const anchor = anchorRef.current;
      const popup = popupRef.current;
      if (!anchor || !popup) return;
      const rect = anchor.getBoundingClientRect();
      const { offsetHeight: height, offsetWidth: width } = popup;
      const fitsBelow = rect.bottom + GAP + height <= window.innerHeight - EDGE;
      const top = fitsBelow || rect.top - GAP - height < EDGE ? rect.bottom + GAP : rect.top - GAP - height;
      const left = Math.min(Math.max(rect.left, EDGE), window.innerWidth - width - EDGE);
      setStyle({
        top: Math.min(Math.max(top, EDGE), Math.max(window.innerHeight - height - EDGE, EDGE)),
        left: Math.max(left, EDGE),
        visibility: 'visible',
      });
    };
    place();
    // Пересчитываем при прокрутке любого контейнера и изменении размера окна.
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    // Размер попапа меняется внутри (второй месяц, сетка годов) — следим и за этим:
    // иначе календарь мог вылезти за нижний край окна.
    const observer = new ResizeObserver(place);
    if (popupRef.current) observer.observe(popupRef.current);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open]);

  // Закрытие по клику вне поля и вне попапа (попап живёт в портале).
  useEffect(() => {
    if (!open) return undefined;
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (wrapRef.current?.contains(target) || popupRef.current?.contains(target)) return;
      setOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  return { open, setOpen, toggle, close, wrapRef, anchorRef, popupRef, style };
}
