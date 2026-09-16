// Смоук: выбор периода дат (шаг выбора + подпись) и сетка каленДАРЯ.
//
// Обе части — чистая логика фронтенда:
//   • `components/ui/Form/date-range-state.ts` — шаг выбора периода;
//   • `components/ui/Form/calendar-state.ts`  — разбор дат, сетка месяца, годы.
import {
  EMPTY_DATE_RANGE,
  formatDateRange,
  isDateRangeEmpty,
  normalizeDateRange,
  stepDateRange,
} from '../../../frontend/src/components/ui/Form/date-range-state';
import {
  decadeStart,
  decadeYears,
  formatDisplayDate,
  isSameDay,
  monthCells,
  monthTitle,
  parseISODate,
  shiftMonth,
  startOfMonth,
  toISODate,
} from '../../../frontend/src/components/ui/Form/calendar-state';
import { createSmoke } from '../helpers/smoke';

const smoke = createSmoke('date-range (выбор периода и календарь)');

function main(): void {
  // Разбор и вывод даты.
  smoke.eq('разбор корректной даты', toISODate(parseISODate('2026-09-14') as Date), '2026-09-14');
  smoke.ok('пустая строка — даты нет', parseISODate('') === null);
  smoke.ok('мусор — даты нет', parseISODate('14.09.2026') === null);
  smoke.ok('отсутствующее значение — даты нет', parseISODate(undefined) === null);
  smoke.eq('вывод даты для поля', formatDisplayDate(new Date(2026, 8, 14)).replace(/\u00a0/g, ' '), '14.09.2026');
  smoke.ok('сравнение одного дня', isSameDay(new Date(2026, 8, 14), new Date(2026, 8, 14, 23, 59)));
  smoke.ok('разные дни не равны', !isSameDay(new Date(2026, 8, 14), new Date(2026, 8, 15)));

  // Навигация по месяцам.
  smoke.eq('начало месяца', toISODate(startOfMonth(new Date(2026, 8, 14))), '2026-09-01');
  smoke.eq('сдвиг вперёд через год', toISODate(shiftMonth(new Date(2026, 11, 1), 1)), '2027-01-01');
  smoke.eq('сдвиг назад через год', toISODate(shiftMonth(new Date(2026, 0, 1), -1)), '2025-12-01');
  smoke.eq('подпись месяца', monthTitle(new Date(2026, 8, 1)), 'сентябрь 2026');

  // Сетка месяца: неделя с понедельника, пустые места до первого дня.
  // 1 сентября 2026 — вторник, поэтому перед ним одно пустое место.
  const september = monthCells(new Date(2026, 8, 1));
  smoke.eq('в сентябре 30 дней и сдвиг в один день', september.length, 1 + 30);
  smoke.eq('первая ячейка пустая', september[0], null);
  smoke.eq('первый день — 1 сентября', toISODate(september[1] as Date), '2026-09-01');
  smoke.eq('последний день — 30 сентября', toISODate(september[september.length - 1] as Date), '2026-09-30');

  // 1 июля 2026 — среда, поэтому пустых мест два.
  const july = monthCells(new Date(2026, 6, 1));
  smoke.eq('в июле 31 день и сдвиг в два дня', july.length, 2 + 31);
  smoke.eq('июль: первые две ячейки пустые', july.slice(0, 2), [null, null]);
  smoke.eq('июль: первый день — 1 июля', toISODate(july[2] as Date), '2026-07-01');

  // Месяц, начинающийся с понедельника, не должен получать пустых ячеек.
  const june = monthCells(new Date(2026, 5, 1));
  smoke.eq('июнь 2026 начинается с понедельника — без сдвига', june.length, 30);
  smoke.eq('июнь: первая ячейка — 1 июня', toISODate(june[0] as Date), '2026-06-01');

  // Быстрый выбор года: десятилетие и его годы.
  smoke.eq('начало десятилетия', decadeStart(new Date(2026, 8, 1)), 2020);
  smoke.eq('граница десятилетия', decadeStart(new Date(2020, 0, 1)), 2020);
  smoke.eq('годы десятилетия', decadeYears(new Date(2026, 8, 1)), [2020, 2021, 2022, 2023, 2024, 2025, 2026, 2027, 2028, 2029]);

  // Шаг выбора периода.
  smoke.ok('пустой период', isDateRangeEmpty(EMPTY_DATE_RANGE));
  const started = stepDateRange(EMPTY_DATE_RANGE, '2026-09-10');
  smoke.eq('первый клик задаёт начало', started.range, { from: '2026-09-10', to: '' });
  smoke.ok('после первого клика период не завершён', !started.complete);

  const finished = stepDateRange(started.range, '2026-09-20');
  smoke.eq('второй клик задаёт окончание', finished.range, { from: '2026-09-10', to: '2026-09-20' });
  smoke.ok('после второго клика период завершён', finished.complete);

  const restarted = stepDateRange(finished.range, '2026-10-01');
  smoke.eq('клик по завершённому периоду начинает новый', restarted.range, { from: '2026-10-01', to: '' });
  smoke.ok('новый период не завершён', !restarted.complete);

  const earlier = stepDateRange(started.range, '2026-09-01');
  smoke.eq('дата раньше начала перезапускает период', earlier.range, { from: '2026-09-01', to: '' });

  // Подпись периода для поля.
  smoke.eq('подпись пустого периода пуста', formatDateRange(EMPTY_DATE_RANGE, (iso) => iso), '');
  smoke.eq('подпись незавершённого периода', formatDateRange(started.range, (iso) => iso), 'с 2026-09-10');
  smoke.eq('подпись завершённого периода', formatDateRange(finished.range, (iso) => iso), '2026-09-10 — 2026-09-20');

  // Защита от перевёрнутого периода (например, из URL).
  smoke.eq(
    'перевёрнутый период нормализуется',
    normalizeDateRange({ from: '2026-09-20', to: '2026-09-10' }),
    { from: '2026-09-10', to: '2026-09-20' },
  );
  smoke.eq('корректный период не меняется', normalizeDateRange(finished.range), finished.range);

  smoke.done();
}

main();
