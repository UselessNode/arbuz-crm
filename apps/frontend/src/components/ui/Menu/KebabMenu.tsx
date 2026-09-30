// KebabMenu — кнопка «⋮» с выпадающим списком действий.
// Используется в таблицах на мобильных, когда полный набор кнопок не помещается.
import { useEffect, useId, useRef, useState } from 'react';
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

      {open ? (
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          aria-label={label}
          className={[styles.menu, styles[align]].join(' ')}
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
        </div>
      ) : null}
    </div>
  );
}
