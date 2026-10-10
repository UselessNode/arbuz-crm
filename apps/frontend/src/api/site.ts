// API справочника регионов и текстовых настроек сайта.
import { api } from './client';

export interface Region {
  id: number;
  name: string;
  isDefault: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface RegionPayload {
  name: string;
  is_default?: boolean;
  sort_order?: number;
}

export const regionsApi = {
  list: () => api.get<{ regions: Region[] }>('/regions'),
  create: (payload: RegionPayload) => api.post<{ region: Region }>('/regions', payload),
  update: (id: number, payload: RegionPayload) => api.patch<{ region: Region }>(`/regions/${id}`, payload),
  remove: (id: number) => api.delete<{ ok: boolean }>(`/regions/${id}`),
};

/** Ключи текстовых настроек — зеркало SITE_SETTING_KEYS на бэкенде. */
export const SITE_SETTING_KEYS = ['about', 'home_contacts', 'footer', 'errors'] as const;
export type SiteSettingKey = (typeof SITE_SETTING_KEYS)[number];

/** Человекочитаемые названия ключей для админского экрана. */
export const SITE_SETTING_LABELS: Record<SiteSettingKey, string> = {
  about: 'Страница «О проекте»',
  home_contacts: 'Блок «Контакты» на главной',
  footer: 'Содержимое подвала',
  errors: 'Страница «Замеченные ошибки»',
};

export interface SiteSetting {
  key: SiteSettingKey;
  text: string;
  html: string;
  updatedBy: number | null;
  updatedAt: string;
}

export const siteSettingsApi = {
  /** Публичное чтение одного блока (главная, подвал, «О проекте»). */
  get: (key: SiteSettingKey) => api.get<{ setting: SiteSetting }>(`/site-settings/${key}`),
  list: () => api.get<{ settings: SiteSetting[] }>('/site-settings'),
  update: (key: SiteSettingKey, text: string) => api.put<{ setting: SiteSetting }>(`/site-settings/${key}`, { text }),
  /** Загрузка картинки, вставленной в текст блока: возвращает адрес для `src`. */
  uploadImage: (key: SiteSettingKey, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.upload<{ url: string }>(`/site-settings/${key}/image`, formData);
  },
};
