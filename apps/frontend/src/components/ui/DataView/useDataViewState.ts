// Состояние DataView с синхронизацией в URL: поиск, фильтры, сортировка, страница, размер.
import { useCallback, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { activeFilters, cycleSort, hasActiveFilters, readQuery, removeFilterValue, writeQuery } from './data-view-query';
import type { ActiveFilter, DataViewQuery, FilterSpec, FilterValue } from './types';

export interface DataViewStateOptions {
  specs: readonly FilterSpec[];
  defaultPageSize?: number;
}

export interface DataViewState {
  query: DataViewQuery;
  specs: readonly FilterSpec[];
  /** Активные фильтры для чипов (с подписями). */
  active: ActiveFilter[];
  hasActiveFilters: boolean;
  setSearch: (value: string) => void;
  setPage: (page: number) => void;
  setPageSize: (pageSize: number) => void;
  /** Клик по заголовку колонки: asc → desc → сброс. */
  toggleSort: (field: string) => void;
  setFilter: (field: string, value: FilterValue) => void;
  clearFilter: (field: string) => void;
  removeActive: (filter: ActiveFilter) => void;
  resetFilters: () => void;
  resetAll: () => void;
  /** Кэш подписей для асинхронных (multi-select) фильтров. */
  registerLabels: (field: string, labels: Record<string, string>) => void;
}

/**
 * Хранит состояние списка и синхронизирует его с query-параметрами адреса.
 * `specs` можно не мемоизировать — хук держит актуальный список в ref.
 */
export function useDataViewState({ specs, defaultPageSize }: DataViewStateOptions): DataViewState {
  const [searchParams, setSearchParams] = useSearchParams();
  const [labels, setLabels] = useState<Record<string, Record<string, string>>>({});
  const specsRef = useRef(specs);
  specsRef.current = specs;

  const query = useMemo(
    () => readQuery(searchParams, specsRef.current, { pageSize: defaultPageSize }),
    [searchParams, defaultPageSize],
  );

  const commit = useCallback(
    (next: DataViewQuery) => {
      setSearchParams(writeQuery(next, specsRef.current, { pageSize: defaultPageSize }), { replace: true });
    },
    [setSearchParams, defaultPageSize],
  );

  const setSearch = useCallback((value: string) => commit({ ...query, search: value, page: 1 }), [commit, query]);
  const setPage = useCallback((page: number) => commit({ ...query, page }), [commit, query]);
  const setPageSize = useCallback((pageSize: number) => commit({ ...query, pageSize, page: 1 }), [commit, query]);
  const toggleSort = useCallback(
    (field: string) => commit({ ...query, sort: cycleSort(query.sort, field), page: 1 }),
    [commit, query],
  );
  const setFilter = useCallback(
    (field: string, value: FilterValue) => commit({ ...query, page: 1, filters: { ...query.filters, [field]: value } }),
    [commit, query],
  );
  const clearFilter = useCallback(
    (field: string) => commit({ ...query, page: 1, filters: removeFilterValue(query.filters, field) }),
    [commit, query],
  );
  const removeActive = useCallback(
    (filter: ActiveFilter) => {
      if (filter.field === 'search') {
        commit({ ...query, search: '', page: 1 });
        return;
      }
      commit({ ...query, page: 1, filters: removeFilterValue(query.filters, filter.field, filter.value) });
    },
    [commit, query],
  );
  const resetFilters = useCallback(() => commit({ ...query, page: 1, filters: {} }), [commit, query]);
  const resetAll = useCallback(
    () => commit({ ...query, search: '', page: 1, filters: {} }),
    [commit, query],
  );
  const registerLabels = useCallback((field: string, next: Record<string, string>) => {
    setLabels((prev) => {
      const existing = prev[field];
      // Не обновляем состояние, если подписи не изменились (иначе бесконечный цикл).
      const merged = { ...existing, ...next };
      const sameSize = existing && Object.keys(existing).length === Object.keys(merged).length;
      if (sameSize) return prev;
      return { ...prev, [field]: merged };
    });
  }, []);

  const active = useMemo(() => activeFilters(query, specsRef.current, labels), [query, labels]);
  const activeFlag = useMemo(() => hasActiveFilters(query), [query]);

  return {
    query,
    specs,
    active,
    hasActiveFilters: activeFlag,
    setSearch,
    setPage,
    setPageSize,
    toggleSort,
    setFilter,
    clearFilter,
    removeActive,
    resetFilters,
    resetAll,
    registerLabels,
  };
}
