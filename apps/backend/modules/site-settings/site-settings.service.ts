// Бизнес-логика настраиваемых администратором текстов сайта («О проекте», контакты, подвал).
// Механизм тот же, что у текстов согласий (consent_documents): хранится Markdown, наружу
// отдаётся безопасный HTML. Отличие — без версионирования: хранится только текущее значение.
import { RoleType } from '@arbuz/shared';
import { prisma } from '../../lib/prisma';
import { httpError } from '../../lib/http';
import { renderMarkdown } from '../posts/markdown';
import { safeOriginalName, validateUpload } from '../files/file-validation';
import { openStored, storeUpload } from '../files/file-storage';
import type { CurrentUser } from '../files/files.service';
import type { Request } from 'express';
import { readMultipartFile } from '../../lib/multipart';

/** Известные ключи настроек — совпадают с SITE_SETTING_KEYS во фронтенде. */
export const SITE_SETTING_KEYS = ['about', 'home_contacts', 'footer', 'errors'] as const;
export type SiteSettingKey = (typeof SITE_SETTING_KEYS)[number];

/** Максимальная длина текста (защита от случайной вставки огромного файла). */
const SITE_SETTING_TEXT_MAX = 100_000;

export interface SiteSetting {
  key: SiteSettingKey;
  /** Исходный Markdown — для админского просмотра/правки. */
  text: string;
  /** Безопасный HTML (рендер и санитизация) — для публичной отдачи. */
  html: string;
  updatedBy: number | null;
  updatedAt: Date;
}

/** Значения по умолчанию — если админ ещё не задал текст. */
export const SITE_SETTING_DEFAULTS: Record<SiteSettingKey, string> = {
  about: '',
  home_contacts: '',
  footer: '',
  errors: '',
};

function isSiteSettingKey(value: string): value is SiteSettingKey {
  return (SITE_SETTING_KEYS as readonly string[]).includes(value);
}

function serialize(key: SiteSettingKey, row: { value: string; updated_by: number | null; updated_at: Date } | null): SiteSetting {
  const text = row?.value ?? SITE_SETTING_DEFAULTS[key];
  return {
    key,
    text,
    html: renderMarkdown(text),
    updatedBy: row?.updated_by ?? null,
    updatedAt: row?.updated_at ?? new Date(0),
  };
}

/** Все известные настройки — с сохранённым значением или значением по умолчанию. */
export async function listSiteSettings(): Promise<SiteSetting[]> {
  const rows = await prisma.site_settings.findMany();
  const byKey = new Map(rows.map((row) => [row.key, row]));
  return SITE_SETTING_KEYS.map((key) => serialize(key, byKey.get(key) ?? null));
}

export async function getSiteSetting(key: string): Promise<SiteSetting> {
  if (!isSiteSettingKey(key)) throw httpError(400, 'Неизвестный ключ настройки', 'INVALID_SETTING_KEY');
  const row = await prisma.site_settings.findUnique({ where: { key } });
  return serialize(key, row);
}

/** Сохраняет (создаёт/обновляет) текст настройки. Только администратор. */
export async function upsertSiteSetting(
  user: CurrentUser,
  key: string,
  text: unknown,
): Promise<SiteSetting> {
  if (user.role !== RoleType.admin) throw httpError(403, 'Действие доступно только администратору', 'FORBIDDEN');
  if (!isSiteSettingKey(key)) throw httpError(400, 'Неизвестный ключ настройки', 'INVALID_SETTING_KEY');

  const value = text === undefined || text === null ? '' : String(text);
  if (value.length > SITE_SETTING_TEXT_MAX) {
    throw httpError(400, 'Текст слишком длинный', 'TEXT_TOO_LONG');
  }

  const row = await prisma.site_settings.upsert({
    where: { key },
    create: { key, value, updated_by: user.id },
    update: { value, updated_by: user.id },
  });
  return serialize(key, row);
}

/**
 * Загрузка картинки для текстового блока (вставляется в Markdown).
 * Файл хранится в каталоге `site/<key>/`, отдаётся публично (картинки на публичных страницах).
 * Возвращает URL для `src`.
 */
export async function uploadSiteSettingImage(user: CurrentUser, key: string, req: Request): Promise<string> {
  if (user.role !== RoleType.admin) throw httpError(403, 'Действие доступно только администратору', 'FORBIDDEN');
  if (!isSiteSettingKey(key)) throw httpError(400, 'Неизвестный ключ настройки', 'INVALID_SETTING_KEY');

  const { buffer, originalName } = await readMultipartFile(req);
  const type = validateUpload(buffer, originalName);
  const relativePath = await storeUpload(buffer, `site/${key}`, type);
  const file = await prisma.files.create({
    data: { name: safeOriginalName(originalName).slice(0, 100), file_type: type, path: relativePath },
  });
  return `/api/site-settings/image/${file.id}`;
}

/** Отдаёт картинку настройки по id (публично). */
export async function openSiteImage(fileId: number) {
  const file = await prisma.files.findFirst({ where: { id: fileId, deleted_at: null } });
  if (!file || !file.path) throw httpError(404, 'Файл не найден', 'FILE_NOT_FOUND');
  const { stream, size } = await openStored(file.path);
  return { stream, size, file };
}
