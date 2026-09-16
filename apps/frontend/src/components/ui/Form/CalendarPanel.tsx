// Общий календарь для выбора даты и периода: несколько месяцев подряд,
// быстрый переход по годам (десятилетие / столетие) и оформление дней.
// Используется в `DatePicker` и `RangeDatePicker`, чтобы вид и навигация совпадали.
// Разбор дат и сетка месяца — в чистом `calendar-state.ts` (покрыт смоук-тестом).
import { useState, type ReactNode } from 'react';
import { Icon } from '../Icon';
import {
  CALENDAR_MONTHS,
  CALENDAR_WEEKDAYS,
  decadeStart,
  decadeYears,
  formatDisplayDate,
  isSameDay,
  monthCells,
  monthTitle,
  shiftMonth,
  startOfMonth,
  toISODate,
} from './calendar-state';
import styles from './Form.module.css';

/** Шаг быстрых переходов в режиме выбора года. */
const DECADE_STEP = 10;
const CENTURY_STEP = 100;

export interface CalendarPanelProps {
  /** Сколько месяцев показывать подряд: 1 — дата, 2 — период. */
  months?: number;
  /** Первый отображаемый месяц (любое число месяца — приведём к первому). */
  viewMonth: Date;
  onViewMonthChange: (next: Date) => void;
  /** День недоступен для выбора. */
  isDayDisabled: (date: Date) => boolean;
  /** Дополнительные классы оформления дня (выбор, диапазон, сегодня). */
  dayClassName?: (date: Date) => string | undefined;
  /** Пометка «текущий выбор» для `aria-current`. */
  isDayCurrent?: (date: Date) => boolean;
  onSelectDay: (date: Date) => void;
  /** Кнопки под календарём («Сегодня», «Очистить»). */
  footer?: ReactNode;
}

/**
 * Сетка календаря с навигацией. Заголовок работает в двух режимах:
 * месяцы (обычный вид) и годы (десятилетие со стрелками ±10 и ±100 лет).
 */
export function CalendarPanel({
  months = 1,
  viewMonth,
  onViewMonthChange,
  isDayDisabled,
  dayClassName,
  isDayCurrent,
  onSelectDay,
  footer,
}: CalendarPanelProps) {
  const [yearMode, setYearMode] = useState(false);
  const month = startOfMonth(viewMonth);
  const today = new Date();
  const start = decadeStart(month);
  const years = decadeYears(month);

  return (
    <div className={styles.calendarPanel}>
      <div className={styles.calendarHeader}>
        {yearMode ? (
          <>
            <button
              type="button"
              className={styles.calendarNav}
              onClick={() => onViewMonthChange(new Date(month.getFullYear() - CENTURY_STEP, month.getMonth(), 1))}
              aria-label="Предыдущее столетие"
            >
              <Icon name="chevron-left" size={14} />
              <Icon name="chevron-left" size={14} />
            </button>
            <button
              type="button"
              className={styles.calendarNav}
              onClick={() => onViewMonthChange(new Date(month.getFullYear() - DECADE_STEP, month.getMonth(), 1))}
              aria-label="Предыдущее десятилетие"
            >
              <Icon name="chevron-left" size={16} />
            </button>
            <span className={styles.calendarTitle}>
              {start}–{start + years.length - 1}
            </span>
            <button
              type="button"
              className={styles.calendarNav}
              onClick={() => onViewMonthChange(new Date(month.getFullYear() + DECADE_STEP, month.getMonth(), 1))}
              aria-label="Следующее десятилетие"
            >
              <Icon name="chevron-right" size={16} />
            </button>
            <button
              type="button"
              className={styles.calendarNav}
              onClick={() => onViewMonthChange(new Date(month.getFullYear() + CENTURY_STEP, month.getMonth(), 1))}
              aria-label="Следующее столетие"
            >
              <Icon name="chevron-right" size={14} />
              <Icon name="chevron-right" size={14} />
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              className={styles.calendarNav}
              onClick={() => onViewMonthChange(shiftMonth(month, -1))}
              aria-label="Предыдущий месяц"
            >
              <Icon name="chevron-left" size={16} />
            </button>
            {/* Клик по месяцу открывает выбор года. */}
            <button
              type="button"
              className={styles.calendarTitleButton}
              onClick={() => setYearMode(true)}
              aria-label="Выбрать год"
            >
              <span className={styles.calendarTitle}>
                {monthTitle(month)}
                {months > 1 ? ` — ${monthTitle(shiftMonth(month, months - 1))}` : ''}
              </span>
            </button>
            <button
              type="button"
              className={styles.calendarNav}
              onClick={() => onViewMonthChange(shiftMonth(month, 1))}
              aria-label="Следующий месяц"
            >
              <Icon name="chevron-right" size={16} />
            </button>
          </>
        )}
      </div>

      {yearMode ? (
        <div className={styles.calendarYears}>
          {years.map((year) => (
            <button
              key={year}
              type="button"
              className={
                year === month.getFullYear() ? `${styles.calendarYear} ${styles.calendarYearActive}` : styles.calendarYear
              }
              onClick={() => {
                onViewMonthChange(new Date(year, month.getMonth(), 1));
                setYearMode(false);
              }}
              aria-current={year === month.getFullYear() ? 'date' : undefined}
            >
              {year}
            </button>
          ))}
        </div>
      ) : (
        <div className={styles.calendarMonths}>
          {Array.from({ length: months }, (_, offset) => {
            const current = shiftMonth(month, offset);
            return (
              <div key={`${current.getFullYear()}-${current.getMonth()}`} className={styles.calendarMonth}>
                {months > 1 ? <div className={styles.calendarMonthLabel}>{monthTitle(current)}</div> : null}
                <div className={styles.calendarWeekdays}>
                  {CALENDAR_WEEKDAYS.map((day) => (
                    <span key={day} className={styles.calendarWeekday}>
                      {day}
                    </span>
                  ))}
                </div>
                <div className={styles.calendarGrid}>
                  {monthCells(current).map((date, index) => {
                    if (!date) return <span key={`empty-${index}`} />;
                    const classes = [
                      styles.calendarDay,
                      isSameDay(date, today) ? styles.calendarDayToday : '',
                      dayClassName?.(date) ?? '',
                    ]
                      .filter(Boolean)
                      .join(' ');
                    return (
                      <button
                        key={toISODate(date)}
                        type="button"
                        className={classes}
                        onClick={() => onSelectDay(date)}
                        disabled={isDayDisabled(date)}
                        aria-label={formatDisplayDate(date)}
                        aria-current={isDayCurrent?.(date) ? 'date' : undefined}
                      >
                        {date.getDate()}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {footer ? <div className={styles.calendarFooter}>{footer}</div> : null}
    </div>
  );
}

export { CALENDAR_MONTHS };
