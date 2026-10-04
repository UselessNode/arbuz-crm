// Фильтр «диапазон дат»: два поля + календарь и (опционально) быстрые пресеты.
import { DateRangeInput } from '../Form';
import type { DateRangeValue } from '../DataView/types';
import styles from './Filters.module.css';

export interface DateRangeFilterProps {
  label: string;
  value: DateRangeValue;
  onChange: (value: DateRangeValue) => void;
  presets?: boolean;
}

function toIso(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function todayIso(): string {
  return toIso(new Date());
}

function shiftDays(iso: string, days: number): string {
  const date = new Date(`${iso}T00:00:00`);
  date.setDate(date.getDate() + days);
  return toIso(date);
}

function presetRanges(): Array<{ label: string; value: DateRangeValue }> {
  const today = todayIso();
  const year = new Date().getFullYear();
  const month = String(new Date().getMonth() + 1).padStart(2, '0');
  return [
    { label: 'Сегодня', value: { from: today, to: today } },
    { label: '7 дней', value: { from: shiftDays(today, -6), to: today } },
    { label: '30 дней', value: { from: shiftDays(today, -29), to: today } },
    { label: 'Этот месяц', value: { from: `${year}-${month}-01`, to: today } },
    { label: 'Прошлый год', value: { from: `${year - 1}-01-01`, to: `${year - 1}-12-31` } },
  ];
}

export function DateRangeFilter({ label, value, onChange, presets }: DateRangeFilterProps) {
  return (
    <div className={styles.filterItem}>
      <DateRangeInput label={label} value={value} onChange={onChange} />
      {presets ? (
        <div className={styles.presets}>
          {presetRanges().map((preset) => {
            const active = preset.value.from === value.from && preset.value.to === value.to;
            return (
              <button
                key={preset.label}
                type="button"
                className={styles.presetButton}
                aria-pressed={active}
                onClick={() => onChange(preset.value)}
              >
                {preset.label}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
