// Drag & drop поле для файлов: перетаскивание + клик для выбора.
import { useRef, useState, type DragEvent, type InputHTMLAttributes, type ReactNode } from 'react';
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

export function DragDrop({ onFiles, accept, multiple = true, disabled = false, hint }: DragDropProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const emit = (files: FileList | null) => {
    if (!files || files.length === 0 || disabled) return;
    onFiles?.(Array.from(files));
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    if (disabled) return;
    emit(event.dataTransfer.files);
  };

  const openPicker = () => {
    if (disabled) return;
    inputRef.current?.click();
  };

  const inputProps: InputHTMLAttributes<HTMLInputElement> = {
    type: 'file',
    hidden: true,
    multiple,
    accept,
    onChange: (event) => {
      emit(event.target.files);
      event.target.value = '';
    },
  };

  const classes = [styles.zone, dragging ? styles.dragging : '', disabled ? styles.disabled : '']
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={classes}
      onClick={openPicker}
      onDragOver={(event) => {
        event.preventDefault();
        if (!disabled) setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      role="button"
      tabIndex={disabled ? -1 : 0}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') openPicker();
      }}
      aria-label="Загрузить файлы"
    >
      <Icon name="upload" size={28} />
      <div className={styles.text}>{hint ?? 'Перетащите файлы сюда или нажмите для выбора'}</div>
      <input ref={inputRef} {...inputProps} />
    </div>
  );
}
