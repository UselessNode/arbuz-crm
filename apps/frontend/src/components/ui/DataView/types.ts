// Типы централизованного DataView: схема фильтров, запрос и режимы панели.
//
// ВАЖНО: этот модуль должен оставаться «чистым» (без импортов из .tsx) — его
// импортируют смоук-тесты, которые проверяются компилятором backend без `--jsx`.

/** Вариант значения фильтра (используется в выпадающих списках и автокомплите). */
export interface FilterOption {
  value: string;
  label: string;
}

export interface CheckboxGroupSpec {
  kind: 'checkbox-group';
  /** Имя поля (совпадает с query-параметром). */
  field: string;
  label: string;
  options: readonly FilterOption[];
  /** При 2–3 опциях рисуем segmented-контрол вместо чекбоксов. */
  segmented?: boolean;
}

export interface MultiSelectSpec {
  kind: 'multi-select';
  field: string;
  label: string;
  /** Асинхронная загрузка вариантов (автокомплит); пустой запрос — варианты по умолчанию. */
  loadOptions: (search: string) => Promise<FilterOption[]>;
  placeholder?: string;
  /** Минимум символов для запроса к серверу. */
  minChars?: number;
}

export interface SelectSpec {
  kind: 'select';
  field: string;
  label: string;
  options: readonly FilterOption[];
  placeholder?: string;
}

export interface DateRangeSpec {
  kind: 'date-range';
  field: string;
  label: string;
  /** Показывать быстрые пресеты («Сегодня», «7 дней», «Этот месяц», «Прошлый год»). */
  presets?: boolean;
}

export interface RangeSpec {
  kind: 'range';
  field: string;
  label: string;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
}

export type FilterSpec = CheckboxGroupSpec | MultiSelectSpec | SelectSpec | DateRangeSpec | RangeSpec;

/** Значения фильтров разного вида. */
export type FilterValue = string[] | DateRangeValue | RangeValue;

export interface DateRangeValue {
  from: string;
  to: string;
}

export interface RangeValue {
  min: number | null;
  max: number | null;
}

export interface DataViewSort {
  field: string;
  direction: 'asc' | 'desc';
}

export interface DataViewQuery {
  search: string;
  /** 1-based. */
  page: number;
  pageSize: number;
  sort: DataViewSort | null;
  filters: Record<string, FilterValue>;
}

/** Режим панели управления. */
export type DataViewMode = 'minimal' | 'standard' | 'advanced' | 'pro';

/** Активный фильтр для отображения чипом. */
export interface ActiveFilter {
  key: string;
  field: string;
  label: string;
  text: string;
  /** Если задано — удаляется только это значение (для мультизначных фильтров). */
  value?: string;
}
