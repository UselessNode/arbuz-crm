// Drag & drop поле для файлов: перетаскивание + клик для выбора.
import { useState, type DragEvent, type ReactNode } from 'react';
import { Icon } from '../Icon';
import styles from './DragDrop.module.css';

export interface DragDropProps {
  /** Вызывается при выборе/сбросе файлов. */
  onFiles?: (files: File[]) => void;
  /** Ограничение типов (accept атрибут), например ".pdf,.docx,image/*". */
  accept?: string;
  multiple?: boolean;
  disabled?: boolean;
  hint?: ReactNode;
}

/**
 * Зона загрузки файлов.
 *
 * Клик реализован через нативный `<label>` + скрытый `input[type=file]`, а не
 * через программный `input.click()` с `hidden`: `display:none`-поле в части
 * браузеров не открывает системный диалог (а внутри модального окна с
 * фокус-ловушкой — тем более). Label-связка работает везде и доступна с клавиатуры.
 */
export function DragDrop({ onFiles, accept, multiple = true, disabled = false, hint }: DragDropProps) {
  const [dragging, setDragging] = useState(false);

  const emit = (files: FileList | null) => {
    if (!files || files.length === 0 || disabled) return;
    onFiles?.(Array.from(files));
  };

  const handleDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setDragging(false);
    if (disabled) return;
    emit(event.dataTransfer.files);
  };

  const classes = [styles.zone, dragging ? styles.dragging : '', disabled ? styles.disabled : '']
    .filter(Boolean)
    .join(' ');

  return (
    <label
      className={classes}
      onDragOver={(event) => {
        event.preventDefault();
        if (!disabled) setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      aria-disabled={disabled || undefined}
    >
      <Icon name="upload" size={28} />
      <div className={styles.text}>{hint ?? 'Перетащите файлы сюда или нажмите для выбора'}</div>
      <input
        className={styles.input}
        type="file"
        accept={accept}
        multiple={multiple}
        disabled={disabled}
        onChange={(event) => {
          emit(event.target.files);
          event.target.value = '';
        }}
      />
    </label>
  );
}
