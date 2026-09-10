// Модальное окно: заголовок, контент, подвал; закрытие по Esc и клику по фону.
import { useEffect, type ReactNode } from 'react';
import { Icon } from '../Icon';
import styles from './Feedback.module.css';

export interface ModalProps {
  open: boolean;
  title?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  width?: number;
}

export function Modal({ open, title, onClose, children, footer, width }: ModalProps) {
  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div
        className={styles.dialog}
        style={width ? { maxWidth: width } : undefined}
        role="dialog"
        aria-modal="true"
        onClick={(event) => event.stopPropagation()}
      >
        <header className={styles.dialogHeader}>
          <span className={styles.dialogTitle}>{title}</span>
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
