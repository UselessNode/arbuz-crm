// Выбор периода дат кнопкой: календарь на два месяца с быстрым переходом по годам.
// Значение — { from, to } в формате yyyy-mm-dd ('' — граница не выбрана).
// Для ручного ввода используйте `DateRangeInput` — там те же данные и тот же календарь.
import { useEffect, useId, useState, type ReactNode } from 'react';
import { Icon } from '../Icon';
import { formatDisplayDate, parseISODate, startOfMonth } from './calendar-state';
import { formatDateRange, type DateRange } from './date-range-state';
import { RangeCalendarPopup } from './RangeCalendarPopup';
import { usePopover } from './use-popover';
import styles from './Form.module.css';

export interface RangeDatePickerProps {
  label?: ReactNode;
  error?: ReactNode;
  value: DateRange;
  onChange: (value: DateRange) => void;
  /** Минимальная доступная дата (yyyy-mm-dd). */
  min?: string;
  /** Максимальная доступная дата (yyyy-mm-dd). */
  max?: string;
  /** Сколько месяцев показывать сразу (по умолчанию 2 — период удобнее выбирать). */
  months?: number;
  disabled?: boolean;
  placeholder?: string;
}

export function RangeDatePicker({
  label,
  error,
  value,
  onChange,
  min,
  max,
  months = 2,
  disabled = false,
  placeholder = 'Выберите период',
}: RangeDatePickerProps) {
  const { open, toggle, close, wrapRef, anchorRef, popupRef, style } = usePopover();
  const popupId = useId();
  const fromDate = parseISODate(value.from);
  const toDate = parseISODate(value.to);
  const [viewMonth, setViewMonth] = useState(() => startOfMonth(fromDate ?? toDate ?? new Date()));

  // Открытие календаря показывает месяц начала периода (или текущий).
  useEffect(() => {
    if (!open) return;
    setViewMonth(startOfMonth(fromDate ?? toDate ?? new Date()));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const display = formatDateRange(value, (iso) => {
    const parsed = parseISODate(iso);
    return parsed ? formatDisplayDate(parsed) : iso;
  });

  return (
    <div className={styles.field} ref={wrapRef}>
      {label ? <span className={styles.label}>{label}</span> : null}
      <div className={styles.dateWrap}>
        <button
          ref={anchorRef}
          type="button"
          className={`${styles.dateButton} ${error ? styles.inputError : ''}`}
          onClick={toggle}
          disabled={disabled}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-controls={open ? popupId : undefined}
        >
          <span className={display ? undefined : styles.datePlaceholder}>{display || placeholder}</span>
          <Icon name="calendar" size={15} className={styles.dateIcon} />
        </button>
      </div>
      {error ? <span className={styles.error}>{error}</span> : null}

      <RangeCalendarPopup
        open={open}
        popupRef={popupRef}
        style={style}
        popupId={popupId}
        viewMonth={viewMonth}
        onViewMonthChange={setViewMonth}
        months={months}
        value={value}
        onChange={onChange}
        min={min}
        max={max}
        onComplete={close}
      />
    </div>
  );
}
