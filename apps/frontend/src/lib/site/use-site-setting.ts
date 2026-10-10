// Чтение текстового блока сайта (site-settings). Публичный эндпоинт — доступен и до входа.
// Возвращает исходный текст и готовый HTML; локальные значения-заглушки — на случай ошибки сети.
import { useEffect, useState } from 'react';
import { siteSettingsApi, type SiteSetting, type SiteSettingKey } from '../../api/site';

export interface SiteSettingValue {
  text: string;
  html: string;
  loading: boolean;
}

export function useSiteSetting(key: SiteSettingKey, fallbackText = ''): SiteSettingValue {
  const [value, setValue] = useState<SiteSettingValue>({ text: fallbackText, html: '', loading: true });

  useEffect(() => {
    let cancelled = false;
    siteSettingsApi
      .get(key)
      .then(({ setting }) => {
        if (cancelled) return;
        setValue({ text: setting.text, html: setting.html, loading: false });
      })
      .catch(() => {
        if (!cancelled) setValue({ text: fallbackText, html: '', loading: false });
      });
    return () => {
      cancelled = true;
    };
  }, [key, fallbackText]);

  return value;
}

export type { SiteSetting };
