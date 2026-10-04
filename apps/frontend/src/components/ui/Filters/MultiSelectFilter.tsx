// Multi-select с асинхронным автокомплитом: токены (chips) выбранного + выпадающий список.
import { useCallback, useEffect, useRef, useState } from 'react';
import { Icon } from '../Icon';
import type { FilterOption } from '../DataView/types';
import styles from './Filters.module.css';

export interface MultiSelectFilterProps {
  label: string;
  value: string[];
  onChange: (value: string[]) => void;
  /** Асинхронная загрузка вариантов; пустой запрос — варианты по умолчанию. */
  loadOptions: (search: string) => Promise<FilterOption[]>;
  placeholder?: string;
  minChars?: number;
  /** Отдаёт карту value → label наружу (для чипов активных фильтров). */
  onLabels?: (labels: Record<string, string>) => void;
}

export function MultiSelectFilter({
  label,
  value,
  onChange,
  loadOptions,
  placeholder = 'Начните вводить…',
  minChars = 1,
  onLabels,
}: MultiSelectFilterProps) {
  const [input, setInput] = useState('');
  const [options, setOptions] = useState<FilterOption[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [labels, setLabels] = useState<Record<string, string>>({});
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const requestRef = useRef(0);
  // Держим колбэки в ref: их идентичность не должна перезапускать загрузку.
  const loadRef = useRef(loadOptions);
  loadRef.current = loadOptions;
  const labelsCallbackRef = useRef(onLabels);
  labelsCallbackRef.current = onLabels;

  const runLoad = useCallback(async (search: string) => {
    const requestId = ++requestRef.current;
    setLoading(true);
    try {
      const result = await loadRef.current(search);
      if (requestId !== requestRef.current) return;
      setOptions(result);
      setLabels((prev) => {
        const next = { ...prev };
        for (const option of result) next[option.value] = option.label;
        return next;
      });
    } catch {
      if (requestId === requestRef.current) setOptions([]);
    } finally {
      if (requestId === requestRef.current) setLoading(false);
    }
  }, []);

  // Первичная загрузка: подписи для уже выбранных значений + варианты по умолчанию.
  useEffect(() => {
    void runLoad('');
  }, [runLoad]);

  // Debounce ввода.
  useEffect(() => {
    const trimmed = input.trim();
    if (trimmed.length > 0 && trimmed.length < minChars) return undefined;
    const timer = window.setTimeout(() => void runLoad(trimmed), 300);
    return () => window.clearTimeout(timer);
  }, [input, minChars, runLoad]);

  useEffect(() => {
    labelsCallbackRef.current?.(labels);
  }, [labels]);

  // Закрытие по клику вне.
  useEffect(() => {
    if (!open) return undefined;
    const handle = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;
      if (target && wrapperRef.current && !wrapperRef.current.contains(target)) setOpen(false);
    };
    document.addEventListener('mousedown', handle);
    document.addEventListener('touchstart', handle);
    return () => {
      document.removeEventListener('mousedown', handle);
      document.removeEventListener('touchstart', handle);
    };
  }, [open]);

  const toggle = (option: string) => {
    onChange(value.includes(option) ? value.filter((item) => item !== option) : [...value, option]);
  };

  return (
    <div className={styles.filterItem}>
      <span className={styles.filterLabel}>{label}</span>
      <div className={styles.multi} ref={wrapperRef}>
        <div className={styles.multiControl} onClick={() => setOpen(true)}>
          {value.map((item) => (
            <span key={item} className={styles.token}>
              <span className={styles.tokenLabel}>{labels[item] ?? item}</span>
              <button
                type="button"
                className={styles.tokenRemove}
                aria-label={`Убрать ${labels[item] ?? item}`}
                onClick={(event) => {
                  event.stopPropagation();
                  onChange(value.filter((current) => current !== item));
                }}
              >
                <Icon name="close" size={12} />
              </button>
            </span>
          ))}
          <input
            type="text"
            className={styles.multiInput}
            value={input}
            placeholder={value.length ? '' : placeholder}
            onFocus={() => setOpen(true)}
            onChange={(event) => {
              setInput(event.target.value);
              setOpen(true);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                const first = options[0];
                if (first && !value.includes(first.value)) onChange([...value, first.value]);
                setInput('');
              } else if (event.key === 'Backspace' && !input && value.length > 0) {
                onChange(value.slice(0, -1));
              }
            }}
          />
        </div>
        {open ? (
          <div className={styles.options} role="listbox" aria-label={label}>
            {loading ? (
              <div className={styles.optionsEmpty}>Загрузка…</div>
            ) : options.length === 0 ? (
              <div className={styles.optionsEmpty}>Ничего не найдено</div>
            ) : (
              options.map((option) => {
                const active = value.includes(option.value);
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="option"
                    aria-selected={active}
                    className={`${styles.option} ${active ? styles.optionActive : ''}`}
                    onClick={() => toggle(option.value)}
                  >
                    {option.label}
                    {active ? (
                      <span className={styles.optionMark}>
                        <Icon name="check" size={12} />
                      </span>
                    ) : null}
                  </button>
                );
              })
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
