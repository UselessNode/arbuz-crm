// Справочник регионов: загрузка списка и определение региона по умолчанию.
import { useEffect, useState } from 'react';
import { regionsApi, type Region } from '../api/site';

export interface RegionsState {
  regions: Region[];
  loading: boolean;
  /** id региона по умолчанию (или первого) — для предзаполнения формы. */
  defaultId: string;
}

/** Загружает список регионов один раз; `defaultId` — id региона по умолчанию. */
export function useRegions(): RegionsState {
  const [regions, setRegions] = useState<Region[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    regionsApi
      .list()
      .then(({ regions: rows }) => {
        if (!cancelled) setRegions(rows);
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const preferred = regions.find((region) => region.isDefault) ?? regions[0];
  return { regions, loading, defaultId: preferred ? String(preferred.id) : '' };
}
