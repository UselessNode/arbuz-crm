// Бизнес-логика публичных документов (раздел «Документы» на главной и в админке).
// Файл хранится через общий модуль files; администратор управляет списком.
import { RoleType } from '@arbuz/shared';
import { NotificationType } from '@arbuz/shared';
import type { Request } from 'express';
import { prisma } from '../../lib/prisma';
import { httpError } from '../../lib/http';
import { readMultipartFile } from '../../lib/multipart';
import { optionalText, requiredText } from '../../lib/parse';
import type { CurrentUser } from '../files/files.service';
import { safeOriginalName, validateUpload } from '../files/file-validation';
import { openStored, storeUpload } from '../files/file-storage';
import { notifyAll } from '../notifications/notifications.service';
import { isConsentTemplateKind } from '../consents/consents.service';

export interface DocumentData {
  id: number;
  title: string;
  description: string | null;
  fileName: string;
  fileType: string | null;
  sortOrder: number;
  isPublished: boolean;
  /** 'minor' | 'adult' | null — назначен ли документ шаблоном согласия ПДн. */
  consentTemplateKind: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const documentSelect = {
  id: true,
  title: true,
  description: true,
  sort_order: true,
  is_published: true,
  consent_template_kind: true,
  created_at: true,
  updated_at: true,
  file: { select: { name: true, file_type: true } },
} as const;

interface DocumentRow {
  id: number;
  title: string;
  description: string | null;
  sort_order: number;
  is_published: boolean;
  consent_template_kind: string | null;
  created_at: Date;
  updated_at: Date;
  file: { name: string; file_type: string | null };
}

function serialize(document: DocumentRow): DocumentData {
  return {
    id: document.id,
    title: document.title,
    description: document.description,
    fileName: document.file.name,
    fileType: document.file.file_type,
    sortOrder: document.sort_order,
    isPublished: document.is_published,
    consentTemplateKind: document.consent_template_kind,
    createdAt: document.created_at,
    updatedAt: document.updated_at,
  };
}

function requireAdmin(user: CurrentUser): void {
  if (user.role !== RoleType.admin) throw httpError(403, 'Действие доступно только администратору', 'FORBIDDEN');
}

const publicWhere = { deleted_at: null, is_published: true, file: { deleted_at: null } } as const;

/** Публичный список: опубликованные документы по порядку. */
export async function listPublicDocuments(): Promise<DocumentData[]> {
  const documents = await prisma.documents.findMany({
    where: publicWhere,
    orderBy: [{ sort_order: 'asc' }, { id: 'asc' }],
    select: documentSelect,
  });
  return documents.map(serialize);
}

/** Список для админки: все документы (включая снятые с публикации). */
export async function listManagedDocuments(user: CurrentUser): Promise<DocumentData[]> {
  requireAdmin(user);
  const documents = await prisma.documents.findMany({
    where: { deleted_at: null },
    orderBy: [{ sort_order: 'asc' }, { id: 'asc' }],
    select: documentSelect,
  });
  return documents.map(serialize);
}

export interface DocumentInput {
  title?: unknown;
  description?: unknown;
  sort_order?: unknown;
  is_published?: unknown;
  /** undefined — не менять; ''/null — снять привязку; 'minor'/'adult' — назначить шаблоном. */
  consent_template_kind?: unknown;
}

/** Разбор вида шаблона согласия: пусто → null, иначе 'minor' | 'adult'. */
function parseTemplateKind(raw: unknown): string | null {
  if (raw === undefined || raw === null || raw === '') return null;
  if (!isConsentTemplateKind(raw)) {
    throw httpError(400, 'Неизвестный вид шаблона согласия', 'INVALID_TEMPLATE_KIND');
  }
  return raw;
}

/** Разбор порядкового номера (пусто → 0). */
function parseSortOrder(raw: unknown): number {
  if (raw === undefined || raw === null || raw === '') return 0;
  const value = Number(raw);
  if (!Number.isFinite(value) || !Number.isInteger(value)) {
    throw httpError(400, 'Порядок отображения должен быть целым числом', 'INVALID_SORT_ORDER');
  }
  return value;
}

/** В multipart флаг приходит строкой: "false"/"0"/"" — ложь, иначе истина. */
function parseFormBool(raw: string | undefined, fallback: boolean): boolean {
  if (raw === undefined || raw === '') return fallback;
  return raw !== 'false' && raw !== '0';
}

/** Загрузка нового документа (multipart: файл + поля title/description/…). Только админ. */
export async function createDocument(req: Request, user: CurrentUser): Promise<DocumentData> {
  requireAdmin(user);
  const { buffer, originalName, fields } = await readMultipartFile(req);
  const type = validateUpload(buffer, originalName);

  const title = requiredText(fields.title, 'Название документа', 255);
  const description = optionalText(fields.description);
  const sortOrder = parseSortOrder(fields.sort_order);
  const isPublished = parseFormBool(fields.is_published, true);
  const consentTemplateKind = parseTemplateKind(fields.consent_template_kind);

  const relativePath = await storeUpload(buffer, 'documents', type);

  const created = await prisma.$transaction(async (tx) => {
    // Шаблон согласия для каждого вида — один: снимаем прежнее назначение.
    if (consentTemplateKind) {
      await tx.documents.updateMany({
        where: { consent_template_kind: consentTemplateKind },
        data: { consent_template_kind: null },
      });
    }
    const file = await tx.files.create({
      data: { name: safeOriginalName(originalName).slice(0, 100), file_type: type, path: relativePath },
      select: { id: true },
    });
    return tx.documents.create({
      data: {
        title,
        description,
        file_id: file.id,
        sort_order: sortOrder,
        is_published: isPublished,
        consent_template_kind: consentTemplateKind,
      },
      select: documentSelect,
    });
  });
  // Опубликованный документ — рассылаем уведомление всем.
  if (created.is_published) {
    await notifyAll({
      type: NotificationType.document,
      title: 'Новый документ',
      body: created.title,
      link: `/#document-${created.id}`,
    });
  }
  return serialize(created);
}

/** Правка метаданных документа (файл не меняется). Только админ. */
export async function updateDocument(
  user: CurrentUser,
  documentId: number,
  input: DocumentInput,
): Promise<DocumentData> {
  requireAdmin(user);
  const existing = await prisma.documents.findFirst({
    where: { id: documentId, deleted_at: null },
    select: { id: true },
  });
  if (!existing) throw httpError(404, 'Документ не найден', 'DOCUMENT_NOT_FOUND');

  const data: {
    title?: string;
    description?: string | null;
    sort_order?: number;
    is_published?: boolean;
    consent_template_kind?: string | null;
  } = {};
  if (input.title !== undefined) data.title = requiredText(input.title, 'Название документа', 255);
  if (input.description !== undefined) data.description = optionalText(input.description);
  if (input.sort_order !== undefined) data.sort_order = parseSortOrder(input.sort_order);
  if (input.is_published !== undefined) data.is_published = Boolean(input.is_published);
  if (input.consent_template_kind !== undefined) data.consent_template_kind = parseTemplateKind(input.consent_template_kind);

  const updated = await prisma.$transaction(async (tx) => {
    // Новый шаблон для вида — единственный: снимаем прежнюю привязку у других документов.
    if (data.consent_template_kind) {
      await tx.documents.updateMany({
        where: { consent_template_kind: data.consent_template_kind, id: { not: documentId } },
        data: { consent_template_kind: null },
      });
    }
    return tx.documents.update({ where: { id: documentId }, data, select: documentSelect });
  });
  return serialize(updated);
}

/** Удаление документа (метка времени; файл скрывается вместе с ним). Только админ. */
export async function deleteDocument(user: CurrentUser, documentId: number): Promise<void> {
  requireAdmin(user);
  const existing = await prisma.documents.findFirst({
    where: { id: documentId, deleted_at: null },
    select: { id: true, file_id: true },
  });
  if (!existing) throw httpError(404, 'Документ не найден', 'DOCUMENT_NOT_FOUND');
  const now = new Date();
  await prisma.$transaction([
    prisma.documents.update({ where: { id: documentId }, data: { deleted_at: now } }),
    prisma.files.update({ where: { id: existing.file_id }, data: { deleted_at: now } }),
  ]);
}

/** Файл документа для скачивания: опубликован — всем, иначе — только администратору. */
export async function downloadDocument(user: CurrentUser | undefined, documentId: number) {
  const document = await prisma.documents.findFirst({
    where: {
      id: documentId,
      deleted_at: null,
      ...(user?.role === RoleType.admin ? {} : { is_published: true }),
    },
    select: { file: { select: { name: true, file_type: true, path: true } } },
  });
  if (!document?.file?.path) throw httpError(404, 'Документ не найден', 'DOCUMENT_NOT_FOUND');
  const { stream, size } = await openStored(document.file.path);
  return { stream, size, file: document.file };
}
