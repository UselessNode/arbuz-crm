// Multi-select с асинхронным автокомплитом: токены (chips) выбранного + выпадающий список.
//
// Список рендерится в портале (`position: fixed`, см. `usePopover` из `Form`): иначе он
// обрезается контейнерами с overflow (аккордеон секции «Экспертизы», модальные окна).
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '../Icon';
import { usePopover } from '../Form/use-popover';
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
  /** Отдаёт наружу выбранные подписи в порядке выбора (для одиночного выбора — одна метка). */
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
  const { open, setOpen, close, wrapRef, anchorRef, popupRef, style } = usePopover();
  const [input, setInput] = useState('');
  const [options, setOptions] = useState<FilterOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [labels, setLabels] = useState<Record<string, string>>({});
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

  const toggle = (option: string) => {
    onChange(value.includes(option) ? value.filter((item) => item !== option) : [...value, option]);
  };

  return (
    <div className={styles.filterItem}>
      <span className={styles.filterLabel}>{label}</span>
      <div className={styles.multi} ref={wrapRef}>
        <button
          ref={anchorRef}
          type="button"
          className={styles.multiControl}
          onClick={() => setOpen(!open)}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-label={label}
        >
          {value.map((item) => (
            <span key={item} className={styles.token}>
              <span className={styles.tokenLabel}>{labels[item] ?? item}</span>
              <span
                className={styles.tokenRemove}
                role="button"
                aria-label={`Убрать ${labels[item] ?? item}`}
                onClick={(event) => {
                  event.stopPropagation();
                  onChange(value.filter((current) => current !== item));
                }}
              >
                <Icon name="close" size={12} />
              </span>
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
              } else if (event.key === 'Escape') {
                close();
              }
            }}
          />
        </button>
        {open
          ? createPortal(
              <div
                ref={popupRef}
                className={`${styles.options} ${styles.optionsPortal}`}
                style={style}
                role="listbox"
                aria-label={label}
              >
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
              </div>,
              document.body,
            )
          : null}
      </div>
    </div>
  );
}
