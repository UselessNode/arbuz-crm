// Попап выбора периода дат: общий для кнопочного поля (`RangeDatePicker`)
// и для строчного поля с маской (`DateRangeInput`), чтобы календарь и правила
// выбора периода были одни и те же.
import type { CSSProperties, RefObject } from 'react';
import { createPortal } from 'react-dom';
import { CalendarPanel } from './CalendarPanel';
import { isSameDay, parseISODate, toISODate } from './calendar-state';
import { stepDateRange, type DateRange } from './date-range-state';
import styles from './Form.module.css';

export interface RangeCalendarPopupProps {
  open: boolean;
  /** Ref на попап — нужен родителю для расчёта позиции (см. `usePopover`). */
  popupRef: RefObject<HTMLDivElement>;
  style: CSSProperties;
  popupId: string;
  /** Первый отображаемый месяц. */
  viewMonth: Date;
  onViewMonthChange: (next: Date) => void;
  months?: number;
  value: DateRange;
  onChange: (next: DateRange) => void;
  min?: string;
  max?: string;
  /** Закрыть календарь (после выбора второй даты). */
  onComplete: () => void;
  /** Пояснение под календарём. */
  hint?: string;
  ariaLabel?: string;
}

export function RangeCalendarPopup({
  open,
  popupRef,
  style,
  popupId,
  viewMonth,
  onViewMonthChange,
  months = 2,
  value,
  onChange,
  min,
  max,
  onComplete,
  hint,
  ariaLabel = 'Календарь периода',
}: RangeCalendarPopupProps) {
  if (!open) return null;

  const minDate = parseISODate(min);
  const maxDate = parseISODate(max);
  const fromDate = parseISODate(value.from);
  const toDate = parseISODate(value.to);

  const isDayDisabled = (date: Date): boolean => {
    if (minDate && date < minDate) return true;
    if (maxDate && date > maxDate) return true;
    return false;
  };

  const dayClassName = (date: Date): string | undefined => {
    if (fromDate && isSameDay(date, fromDate)) return styles.calendarDaySelected;
    if (toDate && isSameDay(date, toDate)) return styles.calendarDaySelected;
    if (fromDate && toDate && date > fromDate && date < toDate) return styles.calendarDayInRange;
    return undefined;
  };

  return createPortal(
    <div
      id={popupId}
      ref={popupRef}
      className={`${styles.datePopup} ${styles.datePopupPortal} ${styles.datePopupWide}`}
      style={style}
      role="dialog"
      aria-label={ariaLabel}
    >
      <CalendarPanel
        months={months}
        viewMonth={viewMonth}
        onViewMonthChange={onViewMonthChange}
        isDayDisabled={isDayDisabled}
        dayClassName={dayClassName}
        isDayCurrent={(date) =>
          (fromDate !== null && isSameDay(date, fromDate)) || (toDate !== null && isSameDay(date, toDate))
        }
        onSelectDay={(date) => {
          const next = stepDateRange(value, toISODate(date));
          onChange(next.range);
          // Вторая дата завершает период — дальше календарь не нужен.
          if (next.complete) onComplete();
        }}
        footer={
          <>
            <span className={styles.calendarHint}>
              {hint ?? (value.from && !value.to ? 'Выберите дату окончания' : 'Выберите начало периода')}
            </span>
            <button
              type="button"
              className={styles.calendarFooterButton}
              onClick={() => onChange({ from: '', to: '' })}
              disabled={!value.from && !value.to}
            >
              Очистить
            </button>
          </>
        }
      />
    </div>,
    document.body,
  );
}
