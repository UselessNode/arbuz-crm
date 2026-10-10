// KebabMenu — кнопка «⋮» с выпадающим списком действий.
// Используется в таблицах на мобильных, когда полный набор кнопок не помещается.
//
// Меню рендерится порталом в `body` с `position: fixed`: иначе внутри контейнера
// с `overflow: auto/hidden` (таблица, скролл-область) оно обрезается и добавляет прокрутку.
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '../Icon';
import styles from './KebabMenu.module.css';

export interface KebabMenuItem {
  key: string;
  label: string;
  icon?: string;
  disabled?: boolean;
  /** Опасное действие — красный текст, приглушение в hover. */
  danger?: boolean;
  onSelect: () => void;
}

export interface KebabMenuProps {
  items: readonly KebabMenuItem[];
  /** Доступное имя триггера: озвучивается скринридером. */
  label?: string;
  /** Выравнивание выпадающего меню относительно триггера. */
  align?: 'start' | 'end';
  /** Имя иконки для триггера. По умолчанию — `kebab-menu` (вертикальное «⋮»). */
  icon?: string;
  className?: string;
}

export function KebabMenu({
  items,
  label = 'Действия',
  align = 'end',
  icon = 'kebab-menu',
  className,
}: KebabMenuProps) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const menuId = useId();

  // Позиция меню в координатах окна (меню в портале, position: fixed).
  const [coords, setCoords] = useState<{ top: number; left?: number; right?: number } | null>(null);

  const updatePosition = () => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const top = rect.bottom + 4;
    if (align === 'start') setCoords({ top, left: rect.left });
    else setCoords({ top, right: window.innerWidth - rect.right });
  };

  useLayoutEffect(() => {
    if (!open) {
      setCoords(null);
      return;
    }
    updatePosition();
    // Пересчёт при прокрутке/изменении размера, чтобы меню следовало за триггером.
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);
    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, align]);

  // Закрытие по клику вне и по Escape. Escape возвращает фокус на триггер.
  useEffect(() => {
    if (!open) return;

    const handlePointer = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;
      if (target && wrapperRef.current && !wrapperRef.current.contains(target)) {
        setOpen(false);
      }
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        setOpen(false);
        triggerRef.current?.focus();
      }
    };

    document.addEventListener('mousedown', handlePointer);
    document.addEventListener('touchstart', handlePointer);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handlePointer);
      document.removeEventListener('touchstart', handlePointer);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  // При открытии переводим фокус на первый доступный пункт.
  useEffect(() => {
    if (!open) return;
    const first = menuRef.current?.querySelector<HTMLButtonElement>('button:not([disabled])');
    first?.focus();
  }, [open]);

  // Стрелки ↑/↓ — навигация внутри меню (простой фокусный цикл).
  const handleMenuKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();
    const buttons = Array.from(
      menuRef.current?.querySelectorAll<HTMLButtonElement>('button:not([disabled])') ?? [],
    );
    if (buttons.length === 0) return;
    const currentIndex = buttons.indexOf(document.activeElement as HTMLButtonElement);
    const delta = event.key === 'ArrowDown' ? 1 : -1;
    const next = buttons[(currentIndex + delta + buttons.length) % buttons.length];
    next.focus();
  };

  const handleSelect = (item: KebabMenuItem) => {
    if (item.disabled) return;
    setOpen(false);
    // Возвращаем фокус на триггер, чтобы не терять позицию в таблице.
    triggerRef.current?.focus();
    item.onSelect();
  };

  return (
    <div
      ref={wrapperRef}
      className={[styles.wrapper, className ?? ''].filter(Boolean).join(' ')}
    >
      <button
        ref={triggerRef}
        type="button"
        className={styles.trigger}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={label}
        title={label}
        onClick={() => setOpen((prev) => !prev)}
      >
        <Icon name={icon} size={16} />
      </button>

      {open && coords
        ? createPortal(
            <div
              ref={menuRef}
              id={menuId}
              role="menu"
              aria-label={label}
              style={{ top: coords.top, left: coords.left, right: coords.right }}
              className={[styles.menu, align === 'start' ? styles.start : styles.end].join(' ')}
              onKeyDown={handleMenuKeyDown}
            >
              {items.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  role="menuitem"
                  className={[styles.item, item.danger ? styles.danger : ''].filter(Boolean).join(' ')}
                  disabled={item.disabled}
                  onClick={() => handleSelect(item)}
                >
                  {item.icon ? (
                    <Icon name={item.icon} size={16} className={styles.itemIcon} />
                  ) : (
                    <span className={styles.itemIcon} aria-hidden="true" />
                  )}
                  <span className={styles.itemLabel}>{item.label}</span>
                </button>
              ))}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
