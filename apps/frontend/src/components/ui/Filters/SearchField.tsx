// Поле поиска с debounce. Внешне контролируемое (значение — из URL).
// Поддерживает свёрнутый вид: кнопка-лупа, по нажатию раскрывается.
import { useEffect, useRef, useState } from 'react';
import { Icon } from '../Icon';
import styles from './Filters.module.css';

export interface SearchFieldProps {
  value: string;
  /** Вызывается с задержкой после окончания ввода. */
  onChange: (value: string) => void;
  placeholder?: string;
  debounceMs?: number;
  /** Свёрнутый вид (режим «минимальный» или открытая панель фильтров). */
  collapsed?: boolean;
  onExpand?: () => void;
  onCollapse?: () => void;
}

export function SearchField({
  value,
  onChange,
  placeholder = 'Поиск…',
  debounceMs = 300,
  collapsed = false,
  onExpand,
  onCollapse,
}: SearchFieldProps) {
  const [text, setText] = useState(value);
  const editingRef = useRef(false);

  // Внешнее значение (из URL) не перетирает ввод, пока пользователь печатает.
  useEffect(() => {
    if (!editingRef.current) setText(value);
  }, [value]);

  useEffect(() => {
    if (!editingRef.current) return;
    const timer = window.setTimeout(() => onChange(text.trim()), debounceMs);
    return () => window.clearTimeout(timer);
  }, [text, debounceMs, onChange]);

  if (collapsed) {
    return (
      <button type="button" className={styles.searchToggle} aria-label="Открыть поиск" title="Поиск" onClick={onExpand}>
        <Icon name="search" size={16} />
      </button>
    );
  }

  const clear = () => {
    editingRef.current = false;
    setText('');
    onChange('');
    // Пустое поле — повторное нажатие сворачивает строку в кнопку.
    if (!text) onCollapse?.();
  };

  return (
    <label className={styles.search}>
      <Icon name="search" size={15} className={styles.searchIcon} />
      <input
        type="text"
        className={styles.searchInput}
        value={text}
        placeholder={placeholder}
        onChange={(event) => {
          editingRef.current = true;
          setText(event.target.value);
        }}
      />
      <button
        type="button"
        className={styles.searchClear}
        aria-label={text ? 'Очистить поиск' : 'Свернуть поиск'}
        onClick={clear}
      >
        <Icon name="close" size={14} />
      </button>
    </label>
  );
}
