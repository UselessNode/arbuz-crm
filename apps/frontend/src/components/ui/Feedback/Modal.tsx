// Модальное окно: заголовок, контент, подвал; закрытие по Esc и клику по фону.
//
// По умолчанию окно закрывается только явно (крестик, кнопки) — чтобы случайный
// клик мимо формы или Esc не уничтожил введённые данные. Для информационных
// диалогов включайте `dismissable`: тогда закрывают и клик по фону, и Esc.
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { Icon } from '../Icon';
import styles from './Feedback.module.css';

export interface ModalProps {
  open: boolean;
  title?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  width?: number;
  /** Закрывать по клику мимо окна и по Esc. По умолчанию — нет. */
  dismissable?: boolean;
}

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Список фокусируемых элементов внутри контейнера в порядке табуляции. */
function getFocusable(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (element) => !element.hasAttribute('disabled'),
  );
}

export function Modal({ open, title, onClose, children, footer, width, dismissable = false }: ModalProps) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  // При открытии запоминаем прежний фокус и переносим его в диалог; при закрытии — возвращаем.
  useEffect(() => {
    if (!open) return undefined;
    previouslyFocusedRef.current = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();
    return () => previouslyFocusedRef.current?.focus?.();
  }, [open]);

  // Esc — закрыть (если окно закрываемое); Tab/Shift+Tab — удержать фокус внутри диалога.
  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (dismissable) onClose();
        return;
      }
      if (event.key !== 'Tab') return;

      const dialog = dialogRef.current;
      if (!dialog) return;

      const focusable = getFocusable(dialog);
      if (focusable.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      if (event.shiftKey) {
        if (active === first || !dialog.contains(active)) {
          event.preventDefault();
          last.focus();
        }
      } else if (active === last || !dialog.contains(active)) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onClose, dismissable]);

  if (!open) return null;

  return (
    <div className={styles.overlay} onClick={dismissable ? onClose : undefined}>
      <div
        ref={dialogRef}
        className={styles.dialog}
        style={width ? { maxWidth: width } : undefined}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
      >
        <header className={styles.dialogHeader}>
          <span id={title ? titleId : undefined} className={styles.dialogTitle}>
            {title}
          </span>
          <button type="button" className={styles.closeButton} onClick={onClose} aria-label="Закрыть">
            <Icon name="close" size={16} />
          </button>
        </header>
        <div className={styles.dialogBody}>{children}</div>
        {footer ? <footer className={styles.dialogFooter}>{footer}</footer> : null}
      </div>
    </div>
  );
}
