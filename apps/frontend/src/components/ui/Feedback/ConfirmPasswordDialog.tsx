// Диалог подтверждения паролем (повторная авторизация перед опасным действием).
// Используется для массового удаления: защита от случайного нажатия и чужого доступа
// к открытой админ-сессии. Пароль не закрывается кликом мимо окна (форма не должна
// терять введённое), пока идёт ввод.
import { useEffect, useState, type ReactNode } from 'react';
import { Button } from '../Button';
import { Input } from '../Form';
import { Modal } from './Modal';
import styles from './Feedback.module.css';

export interface ConfirmPasswordDialogProps {
  open: boolean;
  title?: ReactNode;
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  loading?: boolean;
  /** Ошибка от сервера (например, «Неверный пароль»). */
  error?: ReactNode;
  onConfirm: (password: string) => void;
  onClose: () => void;
}

export function ConfirmPasswordDialog({
  open,
  title = 'Подтвердите действие',
  message,
  confirmLabel = 'Подтвердить',
  cancelLabel = 'Отмена',
  danger = true,
  loading = false,
  error,
  onConfirm,
  onClose,
}: ConfirmPasswordDialogProps) {
  const [password, setPassword] = useState('');

  // При каждом открытии — чистое поле.
  useEffect(() => {
    if (open) setPassword('');
  }, [open]);

  return (
    <Modal
      open={open}
      title={title}
      onClose={onClose}
      width={420}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button
            variant={danger ? 'danger' : 'primary'}
            onClick={() => onConfirm(password)}
            loading={loading}
            disabled={!password}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className={styles.confirmPassword}>
        <div>{message}</div>
        <Input
          label="Пароль администратора"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          error={error}
          autoComplete="current-password"
        />
      </div>
    </Modal>
  );
}
