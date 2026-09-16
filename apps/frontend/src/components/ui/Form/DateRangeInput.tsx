// Период дат одним полем: два ввода с маской и кнопка календаря между ними.
//
// Пользователь сам выбирает способ ввода — набрать даты руками или отметить их
// в календаре: значения общие, поэтому поля и календарь всегда синхронны.
import { useEffect, useId, useState, type ReactNode } from 'react';
import { Icon } from '../Icon';
import { DateInput } from './DateInput';
import { parseISODate, startOfMonth } from './calendar-state';
import type { DateRange } from './date-range-state';
import { RangeCalendarPopup } from './RangeCalendarPopup';
import { usePopover } from './use-popover';
import styles from './Form.module.css';

export interface DateRangeInputProps {
  label?: ReactNode;
  value: DateRange;
  onChange: (value: DateRange) => void;
  /** Минимальная и максимальная допустимая дата (yyyy-mm-dd). */
  min?: string;
  max?: string;
  /** Ошибки по границам (например, «раньше даты начала»). */
  fromError?: ReactNode;
  toError?: ReactNode;
  hint?: ReactNode;
  disabled?: boolean;
}

export function DateRangeInput({
  label,
  value,
  onChange,
  min,
  max,
  fromError,
  toError,
  hint,
  disabled = false,
}: DateRangeInputProps) {
  const { open, toggle, close, wrapRef, anchorRef, popupRef, style } = usePopover();
  const popupId = useId();
  const fromDate = parseISODate(value.from);
  const toDate = parseISODate(value.to);
  const [viewMonth, setViewMonth] = useState(() => startOfMonth(fromDate ?? toDate ?? new Date()));

  useEffect(() => {
    if (!open) return;
    setViewMonth(startOfMonth(fromDate ?? toDate ?? new Date()));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <div className={styles.field} ref={wrapRef}>
      {label ? <span className={styles.label}>{label}</span> : null}
      <div className={styles.dateRangeRow}>
        <DateInput
          label="Начало"
          value={value.from}
          onChange={(next) => onChange({ ...value, from: next })}
          min={min}
          max={value.to || max}
          error={fromError}
          disabled={disabled}
        />
        <button
          ref={anchorRef}
          type="button"
          className={styles.dateRangeCalendarButton}
          onClick={toggle}
          disabled={disabled}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-controls={open ? popupId : undefined}
          aria-label="Открыть календарь для выбора периода"
          title="Выбрать период в календаре"
        >
          <Icon name="calendar" size={17} />
        </button>
        <DateInput
          label="Окончание"
          value={value.to}
          onChange={(next) => onChange({ ...value, to: next })}
          min={value.from || min}
          max={max}
          error={toError}
          disabled={disabled}
        />
      </div>
      {hint ? <span className={styles.hint}>{hint}</span> : null}

      <RangeCalendarPopup
        open={open}
        popupRef={popupRef}
        style={style}
        popupId={popupId}
        viewMonth={viewMonth}
        onViewMonthChange={setViewMonth}
        value={value}
        onChange={onChange}
        min={min}
        max={max}
        onComplete={close}
      />
    </div>
  );
}
