// Выбор даты: кастомный календарь (навигация по месяцам, подсветка диапазона дат).
// Значение — строка формата yyyy-mm-dd ('' — не выбрано).
//
// Календарь рендерится в портале (position: fixed), чтобы выходить за границы
// контейнеров с overflow (например, модального окна) и не обрезаться.
import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '../Icon';
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
  disabled?: boolean;
  placeholder?: string;
}

const MONTHS = [
  'январь',
  'февраль',
  'март',
  'апрель',
  'май',
  'июнь',
  'июль',
  'август',
  'сентябрь',
  'октябрь',
  'ноябрь',
  'декабрь',
];

const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

/** Отступ попапа от поля и от краёв окна (px). */
const GAP = 4;
const EDGE = 8;

/** yyyy-mm-dd → Date (локальная полночь) либо null. */
function parseISODate(value: string | undefined): Date | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

/** Date → yyyy-mm-dd. */
function toISODate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function formatDisplay(date: Date): string {
  return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function isSameDay(left: Date, right: Date): boolean {
  return (
    left.getFullYear() === right.getFullYear() && left.getMonth() === right.getMonth() && left.getDate() === right.getDate()
  );
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
  disabled = false,
  placeholder = 'дд.мм.гггг',
}: DatePickerProps) {
  const popupId = useId();
  const wrapRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [popupStyle, setPopupStyle] = useState<CSSProperties>({ top: 0, left: 0, visibility: 'hidden' });

  const selected = parseISODate(value);
  const minDate = parseISODate(min);
  const maxDate = parseISODate(max);
  const rangeFrom = parseISODate(rangeStart);
  const rangeTo = parseISODate(rangeEnd);

  const [viewMonth, setViewMonth] = useState(() => {
    const base = selected ?? new Date();
    return new Date(base.getFullYear(), base.getMonth(), 1);
  });

  // Открытие календаря показывает месяц выбранной (или текущей) даты.
  useEffect(() => {
    if (!open) return;
    const base = selected ?? new Date();
    setViewMonth(new Date(base.getFullYear(), base.getMonth(), 1));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Позиция попапа: под полем, а если снизу не хватает места — над ним.
  useLayoutEffect(() => {
    if (!open) {
      setPopupStyle({ top: 0, left: 0, visibility: 'hidden' });
      return undefined;
    }
    const place = () => {
      const button = buttonRef.current;
      const popup = popupRef.current;
      if (!button || !popup) return;
      const rect = button.getBoundingClientRect();
      const { offsetHeight: height, offsetWidth: width } = popup;
      const fitsBelow = rect.bottom + GAP + height <= window.innerHeight - EDGE;
      const top = fitsBelow || rect.top - GAP - height < EDGE ? rect.bottom + GAP : rect.top - GAP - height;
      const left = Math.min(Math.max(rect.left, EDGE), window.innerWidth - width - EDGE);
      setPopupStyle({
        top: Math.min(Math.max(top, EDGE), Math.max(window.innerHeight - height - EDGE, EDGE)),
        left: Math.max(left, EDGE),
        visibility: 'visible',
      });
    };
    place();
    // Пересчитываем при прокрутке любого контейнера и изменении размера окна.
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open, viewMonth]);

  // Закрытие по клику вне поля и вне попапа (попап живёт в портале).
  useEffect(() => {
    if (!open) return undefined;
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (wrapRef.current?.contains(target) || popupRef.current?.contains(target)) return;
      setOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  const isDisabledDay = (date: Date): boolean => {
    if (minDate && date < minDate) return true;
    if (maxDate && date > maxDate) return true;
    return false;
  };

  const cells = useMemo(() => {
    const first = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1);
    const leading = (first.getDay() + 6) % 7; // неделя начинается с понедельника
    const daysInMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 0).getDate();
    const result: (Date | null)[] = [];
    for (let i = 0; i < leading; i += 1) result.push(null);
    for (let day = 1; day <= daysInMonth; day += 1) {
      result.push(new Date(viewMonth.getFullYear(), viewMonth.getMonth(), day));
    }
    return result;
  }, [viewMonth]);

  const today = new Date();

  const selectDate = (date: Date) => {
    onChange(toISODate(date));
    setOpen(false);
  };

  const shiftMonth = (delta: number) => {
    setViewMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));
  };

  return (
    <div className={styles.field} ref={wrapRef}>
      {label ? <span className={styles.label}>{label}</span> : null}
      <div className={styles.dateWrap}>
        <button
          ref={buttonRef}
          type="button"
          className={`${styles.dateButton} ${error ? styles.inputError : ''}`}
          onClick={() => setOpen((prev) => !prev)}
          disabled={disabled}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-controls={open ? popupId : undefined}
        >
          <span className={selected ? undefined : styles.datePlaceholder}>{selected ? formatDisplay(selected) : placeholder}</span>
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
              style={popupStyle}
              role="dialog"
              aria-label="Календарь"
            >
              <div className={styles.calendarHeader}>
                <button type="button" className={styles.calendarNav} onClick={() => shiftMonth(-1)} aria-label="Предыдущий месяц">
                  <Icon name="chevron-left" size={16} />
                </button>
                <span className={styles.calendarTitle}>
                  {MONTHS[viewMonth.getMonth()]} {viewMonth.getFullYear()}
                </span>
                <button type="button" className={styles.calendarNav} onClick={() => shiftMonth(1)} aria-label="Следующий месяц">
                  <Icon name="chevron-right" size={16} />
                </button>
              </div>

              <div className={styles.calendarWeekdays}>
                {WEEKDAYS.map((day) => (
                  <span key={day} className={styles.calendarWeekday}>
                    {day}
                  </span>
                ))}
              </div>

              <div className={styles.calendarGrid}>
                {cells.map((date, index) => {
                  if (!date) return <span key={`empty-${index}`} />;
                  const dayDisabled = isDisabledDay(date);
                  const isSelected = selected !== null && isSameDay(date, selected);
                  const isOutsideRange = rangeFrom !== null && rangeTo !== null && date > rangeFrom && date < rangeTo;
                  const isRangeEdge =
                    (rangeFrom !== null && isSameDay(date, rangeFrom)) || (rangeTo !== null && isSameDay(date, rangeTo));
                  const classes = [
                    styles.calendarDay,
                    isSameDay(date, today) ? styles.calendarDayToday : '',
                    isOutsideRange || isRangeEdge ? styles.calendarDayInRange : '',
                    isSelected ? styles.calendarDaySelected : '',
                  ]
                    .filter(Boolean)
                    .join(' ');

                  return (
                    <button
                      key={toISODate(date)}
                      type="button"
                      className={classes}
                      onClick={() => selectDate(date)}
                      disabled={dayDisabled}
                      aria-label={formatDisplay(date)}
                      aria-current={isSelected ? 'date' : undefined}
                    >
                      {date.getDate()}
                    </button>
                  );
                })}
              </div>

              <div className={styles.calendarFooter}>
                <button
                  type="button"
                  className={styles.calendarFooterButton}
                  onClick={() => selectDate(today)}
                  disabled={isDisabledDay(today)}
                >
                  Сегодня
                </button>
                {selected ? (
                  <button type="button" className={styles.calendarFooterButton} onClick={() => onChange('')}>
                    Очистить
                  </button>
                ) : null}
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
