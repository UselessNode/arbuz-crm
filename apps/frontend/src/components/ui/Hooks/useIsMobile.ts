import { useEffect, useState } from 'react';

const DEFAULT_BREAKPOINT = 768;

/** Мобильный вьюпорт: подписка на media-query, без лишних рендеров. */
export function useIsMobile(breakpoint: number = DEFAULT_BREAKPOINT): boolean {
  const query = `(max-width: ${breakpoint - 1}px)`;
  const [isMobile, setIsMobile] = useState<boolean>(() =>
    typeof window === 'undefined' ? false : window.matchMedia(query).matches,
  );
  useEffect(() => {
    const mql = window.matchMedia(query);
    const handle = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mql.addEventListener('change', handle);
    return () => mql.removeEventListener('change', handle);
  }, [query]);
  return isMobile;
}
