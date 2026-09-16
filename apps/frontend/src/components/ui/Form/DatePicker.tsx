// Выбор даты: кастомный календарь (навигация по месяцам и годам, подсветка диапазона дат).
// Значение — строка формата yyyy-mm-dd ('' — не выбрано).
//
// Календарь рендерится в портале (position: fixed) — см. `usePopover`: он не обрезается
// границами контейнеров с overflow (например, модального окна) и сам выбирает сторону.
import { useEffect, useId, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '../Icon';
import { CalendarPanel } from './CalendarPanel';
import { formatDisplayDate, isSameDay, parseISODate, startOfMonth, toISODate } from './calendar-state';
import { usePopover } from './use-popover';
import styles from './Form.module.css';

export interface DatePickerProps {
  label?: ReactNode;
  error?: ReactNode;
  value: string;
  onChange: (value: string) => void;
  /** Минимальная доступная дата (yyyy-mm-dd). */
  min?: string;
  /** Максимальная доступная дата (yyyy-mm-dd). */
  max?: string;
  /** Подсветка диапазона: начало (например, дата начала мероприятия). */
  rangeStart?: string;
  /** Подсветка диапазона: окончание. */
  rangeEnd?: string;
  /** Сколько месяцев показывать сразу (по умолчанию 1). */
  months?: number;
  disabled?: boolean;
  placeholder?: string;
}

export function DatePicker({
  label,
  error,
  value,
  onChange,
  min,
  max,
  rangeStart,
  rangeEnd,
  months = 1,
  disabled = false,
  placeholder = 'дд.мм.гггг',
}: DatePickerProps) {
  const { open, toggle, close, wrapRef, anchorRef, popupRef, style } = usePopover();
  const popupId = useId();

  const selected = parseISODate(value);
  const minDate = parseISODate(min);
  const maxDate = parseISODate(max);
  const rangeFrom = parseISODate(rangeStart);
  const rangeTo = parseISODate(rangeEnd);
  const [viewMonth, setViewMonth] = useState(() => startOfMonth(selected ?? new Date()));

  // Открытие календаря показывает месяц выбранной (или текущей) даты.
  useEffect(() => {
    if (!open) return;
    const base = selected ?? new Date();
    setViewMonth(startOfMonth(base));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const isDayDisabled = (date: Date): boolean => {
    if (minDate && date < minDate) return true;
    if (maxDate && date > maxDate) return true;
    return false;
  };

  const dayClassName = (date: Date): string | undefined => {
    const inRange = rangeFrom !== null && rangeTo !== null && date > rangeFrom && date < rangeTo;
    const edge =
      (rangeFrom !== null && isSameDay(date, rangeFrom)) || (rangeTo !== null && isSameDay(date, rangeTo));
    if (selected !== null && isSameDay(date, selected)) return styles.calendarDaySelected;
    return inRange || edge ? styles.calendarDayInRange : undefined;
  };

  const selectDate = (date: Date) => {
    onChange(toISODate(date));
    close();
  };

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
          <span className={selected ? undefined : styles.datePlaceholder}>
            {selected ? formatDisplayDate(selected) : placeholder}
          </span>
          <Icon name="calendar" size={15} className={styles.dateIcon} />
        </button>
      </div>
      {error ? <span className={styles.error}>{error}</span> : null}

      {open
        ? createPortal(
            <div
              id={popupId}
              ref={popupRef}
              className={`${styles.datePopup} ${styles.datePopupPortal}`}
              style={style}
              role="dialog"
              aria-label="Календарь"
            >
              <CalendarPanel
                months={months}
                viewMonth={viewMonth}
                onViewMonthChange={setViewMonth}
                isDayDisabled={isDayDisabled}
                dayClassName={dayClassName}
                isDayCurrent={(date) => selected !== null && isSameDay(date, selected)}
                onSelectDay={selectDate}
                footer={
                  <>
                    <button
                      type="button"
                      className={styles.calendarFooterButton}
                      onClick={() => selectDate(new Date())}
                      disabled={isDayDisabled(new Date())}
                    >
                      Сегодня
                    </button>
                    {selected ? (
                      <button type="button" className={styles.calendarFooterButton} onClick={() => onChange('')}>
                        Очистить
                      </button>
                    ) : null}
                  </>
                }
              />
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
