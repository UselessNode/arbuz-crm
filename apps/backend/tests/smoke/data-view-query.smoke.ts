// Смоук: (де)сериализация DataView-запроса в URL и построение активных чипов.
//
// Логика чистая и живёт во фронтенде (`apps/frontend/src/components/ui/DataView/data-view-query.ts`):
// проверяем round-trip, опускание дефолтов, разбор всех видов фильтров и удаление значений.
import {
  activeFilters,
  cycleSort,
  hasActiveFilters,
  isFilterValueEmpty,
  readQuery,
  removeFilterValue,
  writeQuery,
} from '../../../frontend/src/components/ui/DataView/data-view-query';
import type { DataViewQuery, FilterSpec } from '../../../frontend/src/components/ui/DataView/types';
import { createSmoke } from '../helpers/smoke';

const smoke = createSmoke('data-view (URL-состояние списка)');

const specs: FilterSpec[] = [
  {
    kind: 'checkbox-group',
    field: 'status',
    label: 'Статус',
    options: [
      { value: 'a', label: 'Активен' },
      { value: 'b', label: 'Закрыт' },
    ],
  },
  { kind: 'multi-select', field: 'expert', label: 'Эксперт', loadOptions: async () => [] },
  { kind: 'date-range', field: 'created', label: 'Создан', presets: true },
  { kind: 'range', field: 'score', label: 'Балл', min: 0, max: 100 },
];

function main(): void {
  // Дефолтный запрос сериализуется в пустую строку.
  const empty: DataViewQuery = { search: '', page: 1, pageSize: 20, sort: null, filters: {} };
  smoke.eq('дефолты опускаются в URL', writeQuery(empty, specs).toString(), '');

  // Полный разбор всех видов фильтров.
  const params = new URLSearchParams(
    'q=abc&page=2&pageSize=50&sort=name&order=desc&status=a,b&created_from=2026-01-01&created_to=2026-01-31&score_min=3&score_max=9',
  );
  const parsed = readQuery(params, specs);
  smoke.eq('поиск', parsed.search, 'abc');
  smoke.eq('страница', parsed.page, 2);
  smoke.eq('размер страницы', parsed.pageSize, 50);
  smoke.eq('сортировка', parsed.sort, { field: 'name', direction: 'desc' });
  smoke.eq('checkbox-group', parsed.filters.status, ['a', 'b']);
  smoke.eq('date-range', parsed.filters.created, { from: '2026-01-01', to: '2026-01-31' });
  smoke.eq('range', parsed.filters.score, { min: 3, max: 9 });

  // Round-trip: запись → чтение даёт исходный запрос.
  const restored = readQuery(writeQuery(parsed, specs), specs);
  smoke.eq('round-trip сохраняет запрос', restored, parsed);

  // Активные чипы: подписи берём из options и из кэша лейблов.
  const chips = activeFilters(parsed, specs, { expert: { '5': 'Иванов' } });
  smoke.ok('чип поиска присутствует', chips.some((chip) => chip.field === 'search'));
  smoke.eq(
    'чип checkbox-group использует label',
    chips.find((chip) => chip.field === 'status' && chip.value === 'a')?.text,
    'Активен',
  );
  smoke.eq('чип date-range форматирует даты', chips.find((chip) => chip.field === 'created')?.text, 'с 01.01.2026 по 31.01.2026');
  smoke.eq('чип range показывает границы', chips.find((chip) => chip.field === 'score')?.text, '3 – 9');

  // Удаление значений.
  smoke.eq('удаление одного значения', removeFilterValue({ status: ['a', 'b'] }, 'status', 'a').status, ['b']);
  smoke.ok('удаление последнего значения убирает фильтр', removeFilterValue({ status: ['a'] }, 'status', 'a').status === undefined);

  // Цикл сортировки: asc → desc → нет.
  smoke.eq('сортировка: первый клик — asc', cycleSort(null, 'x'), { field: 'x', direction: 'asc' });
  smoke.eq('сортировка: второй клик — desc', cycleSort({ field: 'x', direction: 'asc' }, 'x'), {
    field: 'x',
    direction: 'desc',
  });
  smoke.eq('сортировка: третий клик — сброс', cycleSort({ field: 'x', direction: 'desc' }, 'x'), null);

  // Пустые значения.
  smoke.ok('пустой массив — пустой фильтр', isFilterValueEmpty([]));
  smoke.ok('пустой диапазон дат — пустой фильтр', isFilterValueEmpty({ from: '', to: '' }));
  smoke.ok('пустой числовой диапазон — пустой фильтр', isFilterValueEmpty({ min: null, max: null }));
  smoke.ok('нет активных фильтров у дефолта', !hasActiveFilters(empty));
  smoke.ok('есть активные фильтры при поиске', hasActiveFilters({ ...empty, search: 'x' }));

  smoke.done();
}

main();
