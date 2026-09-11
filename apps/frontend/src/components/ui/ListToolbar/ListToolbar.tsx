// Панель инструментов списка: поиск с задержкой ввода + контейнер для фильтров.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Icon } from '../Icon';
import styles from './ListToolbar.module.css';

export interface SearchInputProps {
  /** Вызывается с задержкой после окончания ввода (значение обрезано). */
  onChange: (value: string) => void;
  placeholder?: string;
  debounceMs?: number;
}

export function SearchInput({ onChange, placeholder = 'Поиск…', debounceMs = 300 }: SearchInputProps) {
  const [value, setValue] = useState('');
  const onChangeRef = useRef(onChange);
  const mountedRef = useRef(false);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    // Первый рендер не считается изменением — не дёргаем загрузку зря.
    if (!mountedRef.current) {
      mountedRef.current = true;
      return;
    }
    const timer = window.setTimeout(() => onChangeRef.current(value.trim()), debounceMs);
    return () => window.clearTimeout(timer);
  }, [value, debounceMs]);

  return (
    <label className={styles.search}>
      <Icon name="search" size={15} className={styles.searchIcon} />
      <input
        type="text"
        className={styles.searchInput}
        value={value}
        placeholder={placeholder}
        onChange={(event) => setValue(event.target.value)}
      />
      {value ? (
        <button type="button" className={styles.clear} aria-label="Очистить поиск" onClick={() => setValue('')}>
          <Icon name="close" size={14} />
        </button>
      ) : null}
    </label>
  );
}

export interface ListToolbarProps {
  children: ReactNode;
}

/** Горизонтальная панель над таблицей: поиск и фильтры. */
export function ListToolbar({ children }: ListToolbarProps) {
  return <div className={styles.toolbar}>{children}</div>;
}
