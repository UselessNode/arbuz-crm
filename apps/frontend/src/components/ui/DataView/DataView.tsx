// Централизованная панель управления списком: поиск + фильтры + чипы + таблица + пагинация.
//
// Режимы панели:
//   minimal  — кнопка-лупа, по нажатию раскрывается строка поиска;
//   standard — строка поиска всегда видна, без фильтров;
//   advanced — поиск + сворачиваемая панель фильтров;
//   pro      — как advanced, но панель фильтров открыта по умолчанию.
//
// Состояние (поиск/фильтры/сортировка/страница) хранит `useDataViewState` и синхронизирует с URL;
// сюда оно передаётся объектом `state`. Данные и загрузку держит страница.
import { useMemo, useState, type ReactNode } from 'react';
import { Pagination } from '../Pagination';
import { StateMessage } from '../Feedback';
import { Table, type TableColumn, type TableReorderApi, type TableSelection } from '../Table';
import { Icon } from '../Icon';
import { ActiveFilters } from '../Filters/ActiveFilters';
import { CheckboxGroupFilter } from '../Filters/CheckboxGroupFilter';
import { DateRangeFilter } from '../Filters/DateRangeFilter';
import { MultiSelectFilter } from '../Filters/MultiSelectFilter';
import { RangeFilter } from '../Filters/RangeFilter';
import { SearchField } from '../Filters/SearchField';
import type { DataViewState } from './useDataViewState';
import type { DataViewMode, DateRangeValue, FilterSpec, RangeValue } from './types';
import styles from './DataView.module.css';

/** Колонки DataView структурно совпадают с колонками Table. */
export type DataViewColumn<T> = TableColumn<T>;

export interface DataViewProps<T> {
  state: DataViewState;
  mode: DataViewMode;
  /** Настройки поиска; `false` — скрыть. */
  search?: { placeholder?: string } | false;
  columns: DataViewColumn<T>[];
  rows: T[];
  rowKey: (row: T, index: number) => string | number;
  total: number;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  onRowClick?: (row: T, index: number) => void;
  /** Серверная сортировка по клику на заголовок (по умолчанию включена). */
  sortable?: boolean;
  selection?: TableSelection<T>;
  /** API перетаскивания строк (когда порядок задаётся вручную). */
  reorder?: TableReorderApi<T>;
  /** Перетаскивание выключено (например, при активных фильтрах). */
  reorderDisabled?: boolean;
  bulkActions?: ReactNode;
  selectedCount?: number;
  emptyText?: string;
  noResultsText?: string;
  pageSizeOptions?: readonly number[];
}

const DEFAULT_PAGE_SIZES = [20, 50, 100] as const;

export function DataView<T>({
  state,
  mode,
  search,
  columns,
  rows,
  rowKey,
  total,
  loading = false,
  error = null,
  onRetry,
  onRowClick,
  sortable = true,
  selection,
  reorder,
  reorderDisabled = false,
  bulkActions,
  selectedCount,
  emptyText = 'Нет данных',
  noResultsText = 'Ничего не найдено по вашим фильтрам',
  pageSizeOptions = DEFAULT_PAGE_SIZES,
}: DataViewProps<T>) {
  const [filtersOpen, setFiltersOpen] = useState(mode === 'pro');
  const [searchExpanded, setSearchExpanded] = useState(mode === 'standard');

  const searchCollapsed =
    mode === 'minimal'
      ? !searchExpanded
      : mode === 'advanced' || mode === 'pro'
        ? filtersOpen && !searchExpanded
        : false;

  const filterChipCount = state.active.filter((filter) => filter.field !== 'search').length;

  const toggleFilters = () => {
    setFiltersOpen((open) => {
      const next = !open;
      if (!next) setSearchExpanded(false);
      return next;
    });
  };

  // Выбор строк на текущей странице (с «выбрать всё» в шапке).
  const selectionProps = useMemo<TableSelection<T> | undefined>(() => {
    if (!selection) return undefined;
    const selectedOnPage = rows.filter((row) => selection.isSelected(row)).length;
    const allSelected = rows.length > 0 && selectedOnPage === rows.length;
    const someSelected = selectedOnPage > 0 && !allSelected;
    return {
      isSelected: selection.isSelected,
      onToggle: selection.onToggle,
      onToggleAll: () => {
        const selectAll = !(rows.length > 0 && rows.every(selection.isSelected));
        for (const row of rows) {
          const isSelected = selection.isSelected(row);
          if (selectAll ? !isSelected : isSelected) selection.onToggle(row);
        }
      },
      allSelected,
      someSelected,
    };
  }, [selection, rows]);

  const reorderHint = reorder && reorderDisabled;

  return (
    <div className={styles.view}>
      <div className={styles.toolbar}>
        {search !== false ? (
          <SearchField
            value={state.query.search}
            onChange={state.setSearch}
            placeholder={search?.placeholder}
            collapsed={searchCollapsed}
            onExpand={() => setSearchExpanded(true)}
            onCollapse={() => setSearchExpanded(false)}
          />
        ) : null}

        {state.specs.length > 0 ? (
          <button
            type="button"
            className={`${styles.filterButton} ${filtersOpen ? styles.filterButtonActive : ''}`}
            aria-expanded={filtersOpen}
            onClick={toggleFilters}
          >
            <Icon name="filter" size={15} />
            Фильтры
            {filterChipCount > 0 ? <span className={styles.filterBadge}>{filterChipCount}</span> : null}
          </button>
        ) : null}

        <span className={styles.count} aria-live="polite">
          {loading ? 'Загрузка…' : `Найдено: ${total}`}
        </span>
      </div>

      {filtersOpen && state.specs.length > 0 ? (
        <div className={styles.panel}>
          {state.specs.map((spec) => (
            <FilterControl key={spec.field} spec={spec} state={state} />
          ))}
        </div>
      ) : null}

      <ActiveFilters filters={state.active} onRemove={state.removeActive} onResetAll={state.resetAll} />

      {reorderHint ? (
        <div className={styles.reorderHint}>
          <Icon name="info" size={15} />
          Сбросьте поиск и фильтры, чтобы изменить порядок перетаскиванием.
        </div>
      ) : null}

      {bulkActions ? (
        <div className={styles.bulk}>
          {selectedCount !== undefined ? <span className={styles.bulkCount}>Выбрано: {selectedCount}</span> : null}
          {bulkActions}
        </div>
      ) : null}

      {loading ? (
        <StateMessage state="loading" />
      ) : error ? (
        <StateMessage state="error" message={error} onRetry={onRetry} />
      ) : (
        <>
          <Table
            columns={columns}
            data={rows}
            rowKey={rowKey}
            onRowClick={onRowClick}
            emptyText={state.hasActiveFilters ? noResultsText : emptyText}
            selection={selectionProps}
            sortable={sortable}
            sortKey={sortable ? (state.query.sort?.field ?? null) : undefined}
            sortDirection={state.query.sort?.direction ?? 'asc'}
            onSort={sortable ? state.toggleSort : undefined}
            rowStyle={reorder && !reorderDisabled ? (row, index) => reorder.getRowStyle(row, index) : undefined}
            rowClassName={
              reorder && !reorderDisabled
                ? (row, index) => [reorder.getRowClassName(row, index), styles.draggableRow].filter(Boolean).join(' ')
                : undefined
            }
          />
          {rows.length === 0 && state.hasActiveFilters ? (
            <div className={styles.emptyReset}>
              <button type="button" className={styles.resetButton} onClick={state.resetAll}>
                Сбросить фильтры
              </button>
            </div>
          ) : null}
          <Pagination
            page={state.query.page}
            pageSize={state.query.pageSize}
            total={total}
            onPageChange={state.setPage}
            onPageSizeChange={state.setPageSize}
            pageSizeOptions={pageSizeOptions}
          />
        </>
      )}
    </div>
  );
}

/** Рендер конкретного фильтра по его схеме. */
function FilterControl({ spec, state }: { spec: FilterSpec; state: DataViewState }) {
  if (spec.kind === 'checkbox-group') {
    return (
      <CheckboxGroupFilter
        label={spec.label}
        options={spec.options}
        segmented={spec.segmented}
        value={(state.query.filters[spec.field] as string[] | undefined) ?? []}
        onChange={(value) => state.setFilter(spec.field, value)}
      />
    );
  }
  if (spec.kind === 'multi-select') {
    return (
      <MultiSelectFilter
        label={spec.label}
        value={(state.query.filters[spec.field] as string[] | undefined) ?? []}
        onChange={(value) => state.setFilter(spec.field, value)}
        loadOptions={spec.loadOptions}
        placeholder={spec.placeholder}
        minChars={spec.minChars}
        onLabels={(labels) => state.registerLabels(spec.field, labels)}
      />
    );
  }
  if (spec.kind === 'date-range') {
    return (
      <DateRangeFilter
        label={spec.label}
        value={(state.query.filters[spec.field] as DateRangeValue | undefined) ?? { from: '', to: '' }}
        onChange={(value) => state.setFilter(spec.field, value)}
        presets={spec.presets}
      />
    );
  }
  return (
    <RangeFilter
      label={spec.label}
      value={(state.query.filters[spec.field] as RangeValue | undefined) ?? { min: null, max: null }}
      onChange={(value) => state.setFilter(spec.field, value)}
      min={spec.min}
      max={spec.max}
      step={spec.step}
      unit={spec.unit}
    />
  );
}
