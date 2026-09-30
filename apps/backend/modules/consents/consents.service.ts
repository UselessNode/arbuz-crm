// Бизнес-логика пользовательских соглашений (ПС) и согласий на обработку ПДн.
//
// Требование 152-ФЗ: согласие должно быть конкретным, информированным и однозначным,
// а оператор — уметь доказать его получение. Поэтому здесь две сущности:
//   • consent_documents — неизменяемые редакции текстов (версия + SHA-256 + полный текст),
//     старые редакции не перезаписываются;
//   • consent_events — журнал принятия («кто → что → какую версию → когда → каким действием»),
//     включая IP-адрес и User-Agent как доказательство.
//
// Дополнительно модуль отдаёт образцы согласий ПДн (шаблоны docx/pdf) из каталога templates.
import { createHash } from 'node:crypto';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import { ConsentDocumentType, RoleType } from '@arbuz/shared';
import { config } from '../../lib/config';
import { prisma } from '../../lib/prisma';
import { httpError } from '../../lib/http';
import { oneOf, optionalText } from '../../lib/parse';
import { renderMarkdown } from '../posts/markdown';
import type { CurrentUser } from '../files/files.service';

/** Типы документов соглашений (значения enum из схемы БД). */
export const CONSENT_DOCUMENT_TYPES = [
  ConsentDocumentType.terms,
  ConsentDocumentType.personal_data_consent,
] as const;

export type ConsentDocumentTypeValue = (typeof CONSENT_DOCUMENT_TYPES)[number];

export function isConsentDocumentType(value: unknown): value is ConsentDocumentTypeValue {
  return typeof value === 'string' && (CONSENT_DOCUMENT_TYPES as readonly string[]).includes(value);
}

/** Максимальная длина текста редакции (защита от случайной вставки огромного файла). */
const CONSENT_TEXT_MAX = 500_000;

/** SHA-256 хэш текста редакции (hex, 64 символа). */
export function hashConsentText(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

/** Версия редакции по умолчанию — текущая дата (ISO, только день). */
function defaultVersion(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

interface ConsentDocumentRow {
  id: number;
  document_type: ConsentDocumentTypeValue;
  version: string;
  hash_sha256: string;
  text: string;
  published_at: Date;
  created_by: number | null;
  created_at: Date;
}

const documentSelect = {
  id: true,
  document_type: true,
  version: true,
  hash_sha256: true,
  text: true,
  published_at: true,
  created_by: true,
  created_at: true,
} as const;

export interface ConsentDocument {
  id: number;
  type: ConsentDocumentTypeValue;
  version: string;
  hash: string;
  /** Исходный Markdown — для админского просмотра/правки. */
  text: string;
  /** Безопасный HTML (рендер и санитизация) — для публичной отдачи. */
  html: string;
  publishedAt: Date;
  createdBy: number | null;
  createdAt: Date;
}

function serializeDocument(document: ConsentDocumentRow): ConsentDocument {
  return {
    id: document.id,
    type: document.document_type,
    version: document.version,
    hash: document.hash_sha256,
    text: document.text,
    html: renderMarkdown(document.text),
    publishedAt: document.published_at,
    createdBy: document.created_by,
    createdAt: document.created_at,
  };
}

/** Текущая (последняя опубликованная) редакция документа заданного типа. */
export async function getCurrentConsentDocument(type: ConsentDocumentTypeValue): Promise<ConsentDocument> {
  const document = await prisma.consent_documents.findFirst({
    where: { document_type: type },
    orderBy: [{ published_at: 'desc' }, { id: 'desc' }],
    select: documentSelect,
  });
  if (!document) {
    throw httpError(
      500,
      `Не опубликован документ согласия «${type}» — выполните seed или опубликуйте редакцию`,
      'CONSENT_DOCUMENT_NOT_CONFIGURED',
    );
  }
  return serializeDocument(document);
}

/** История редакций документов (для админского раздела). Опционально — по типу. */
export async function listConsentDocuments(
  user: CurrentUser,
  type?: ConsentDocumentTypeValue,
): Promise<ConsentDocument[]> {
  if (user.role !== RoleType.admin) throw httpError(403, 'Действие доступно только администратору', 'FORBIDDEN');
  const documents = await prisma.consent_documents.findMany({
    where: type ? { document_type: type } : {},
    orderBy: [{ document_type: 'asc' }, { published_at: 'desc' }, { id: 'desc' }],
    select: documentSelect,
  });
  return documents.map(serializeDocument);
}

export interface PublishConsentDocumentInput {
  document_type?: unknown;
  version?: unknown;
  text?: unknown;
}

/**
 * Публикация новой редакции документа. Существующие редакции не изменяются:
 * совпадение (тип, версия) отклоняется — нужна новая версия.
 * Только администратор.
 */
export async function publishConsentDocument(
  user: CurrentUser,
  input: PublishConsentDocumentInput,
): Promise<ConsentDocument> {
  if (user.role !== RoleType.admin) throw httpError(403, 'Действие доступно только администратору', 'FORBIDDEN');

  const type = oneOf(input.document_type, CONSENT_DOCUMENT_TYPES, 'Тип документа');
  const text = String(input.text ?? '').trim();
  if (!text) throw httpError(400, 'Текст документа обязателен', 'INVALID_BODY');
  if (text.length > CONSENT_TEXT_MAX) {
    throw httpError(400, `Текст документа длиннее ${CONSENT_TEXT_MAX} символов`, 'TEXT_TOO_LONG');
  }
  const version = optionalText(input.version) ?? defaultVersion();

  const existing = await prisma.consent_documents.findUnique({
    where: { document_type_version: { document_type: type, version } },
    select: { id: true },
  });
  if (existing) {
    throw httpError(
      409,
      `Редакция «${version}» уже существует — укажите новую версию`,
      'CONSENT_DOCUMENT_VERSION_EXISTS',
    );
  }

  const created = await prisma.consent_documents.create({
    data: {
      document_type: type,
      version,
      text,
      hash_sha256: hashConsentText(text),
      created_by: user.id,
    },
    select: documentSelect,
  });
  return serializeDocument(created);
}

// --- Принятие согласий при регистрации ---

/** Метаданные запроса для доказательной записи. */
export interface ConsentRequestMeta {
  ip: string | null;
  userAgent: string | null;
}

export interface ConsentAcceptance {
  accept_terms?: unknown;
  accept_personal_data_consent?: unknown;
}

/**
 * Требует, чтобы пользователь принял оба обязательных согласия,
 * и возвращает текущие редакции документов. Иначе — 400.
 */
export async function requireRegistrationConsents(
  input: ConsentAcceptance,
): Promise<Record<ConsentDocumentTypeValue, ConsentDocument>> {
  if (input.accept_terms !== true || input.accept_personal_data_consent !== true) {
    throw httpError(
      400,
      'Для регистрации необходимо принять пользовательское соглашение и согласие на обработку персональных данных',
      'CONSENT_REQUIRED',
    );
  }
  const [terms, personalData] = await Promise.all([
    getCurrentConsentDocument(ConsentDocumentType.terms),
    getCurrentConsentDocument(ConsentDocumentType.personal_data_consent),
  ]);
  return {
    [ConsentDocumentType.terms]: terms,
    [ConsentDocumentType.personal_data_consent]: personalData,
  };
}

export interface ConsentEventDraft {
  user_id: number;
  document_type: ConsentDocumentTypeValue;
  document_version: string;
  document_hash: string;
  ip_address: string | null;
  user_agent: string | null;
  acceptance_method: string;
}

/** Готовит записи журнала принятия для обоих документов (для вставки в транзакции). */
export function buildConsentEvents(
  userId: number,
  documents: Record<ConsentDocumentTypeValue, ConsentDocument>,
  meta: ConsentRequestMeta,
): ConsentEventDraft[] {
  return CONSENT_DOCUMENT_TYPES.map((type) => {
    const document = documents[type];
    return {
      user_id: userId,
      document_type: type,
      document_version: document.version,
      document_hash: document.hash,
      ip_address: meta.ip,
      user_agent: meta.userAgent,
      acceptance_method: 'checkbox+submit',
    };
  });
}

// --- Образцы согласий ПДн (шаблоны) ---

/** Виды шаблонов: для несовершеннолетних и совершеннолетних. */
export const CONSENT_TEMPLATE_KINDS = ['minor', 'adult'] as const;
export type ConsentTemplateKind = (typeof CONSENT_TEMPLATE_KINDS)[number];

export function isConsentTemplateKind(value: unknown): value is ConsentTemplateKind {
  return typeof value === 'string' && (CONSENT_TEMPLATE_KINDS as readonly string[]).includes(value);
}

/** Имена файлов шаблонов (хардкод — см. docs/technical-debt.md) и человекочитаемые имена для скачивания. */
const TEMPLATE_FILES: Record<ConsentTemplateKind, { base: string; downloadName: string }> = {
  minor: { base: 'consent-minor', downloadName: 'Согласие на обработку ПДн (до 14 лет)' },
  adult: { base: 'consent-adult', downloadName: 'Согласие на обработку ПДн (с 14 лет)' },
};

/** Приоритет форматов: сначала docx, затем pdf (админ выбирает удобный). */
const TEMPLATE_FORMATS = ['docx', 'pdf'] as const;

export interface ConsentTemplateFile {
  absolutePath: string;
  downloadName: string;
  fileType: string;
  size: number;
}

/** Находит шаблон заданного вида: `consents/<base>.<ext>` в каталоге templates. */
export async function getConsentTemplate(kind: ConsentTemplateKind): Promise<ConsentTemplateFile> {
  const template = TEMPLATE_FILES[kind];
  for (const ext of TEMPLATE_FORMATS) {
    const absolutePath = path.resolve(config.templates.dir, 'consents', `${template.base}.${ext}`);
    const root = path.resolve(config.templates.dir, 'consents');
    if (absolutePath !== root && !absolutePath.startsWith(root + path.sep)) continue;
    const info = await stat(absolutePath).catch(() => null);
    if (info?.isFile()) {
      return { absolutePath, downloadName: `${template.downloadName}.${ext}`, fileType: ext, size: info.size };
    }
  }
  throw httpError(404, 'Шаблон согласия не найден', 'TEMPLATE_NOT_FOUND');
}
