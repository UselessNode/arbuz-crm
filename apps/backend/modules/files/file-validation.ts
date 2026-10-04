// Проверка загружаемых файлов: допустимые типы (PDF, DOCX, JPEG, PNG, MP4)
// по «магическим байтам» и расширению. Никакого выполнения содержимого.
//
// В БД (колонки file_type, VARCHAR(50)) хранится короткий токен типа
// (pdf/docx/jpg/png/mp4) — полный MIME у DOCX длиннее 50 символов.
// MIME вычисляется при отдаче файла (см. fileMime).
import { httpError } from '../../lib/http';

export const FileTypes = {
  PDF: 'pdf',
  DOCX: 'docx',
  JPG: 'jpg',
  PNG: 'png',
  MP4: 'mp4',
} as const;

export type FileType = (typeof FileTypes)[keyof typeof FileTypes];

export const ALLOWED_TYPES: readonly FileType[] = [
  FileTypes.PDF,
  FileTypes.DOCX,
  FileTypes.JPG,
  FileTypes.PNG,
  FileTypes.MP4,
];

const MIME_BY_TYPE: Record<FileType, string> = {
  [FileTypes.PDF]: 'application/pdf',
  [FileTypes.DOCX]: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  [FileTypes.JPG]: 'image/jpeg',
  [FileTypes.PNG]: 'image/png',
  [FileTypes.MP4]: 'video/mp4',
};

const EXTENSION_TO_TYPE: Record<string, FileType> = {
  pdf: FileTypes.PDF,
  docx: FileTypes.DOCX,
  jpg: FileTypes.JPG,
  jpeg: FileTypes.JPG,
  png: FileTypes.PNG,
  mp4: FileTypes.MP4,
};

/** MIME по сохранённому токену типа (для заголовка Content-Type). */
export function fileMime(fileType: string | null | undefined): string {
  if (fileType && fileType in MIME_BY_TYPE) return MIME_BY_TYPE[fileType as FileType];
  return 'application/octet-stream';
}

/** PDF и картинки можно показывать в браузере (inline), остальное — скачивать. */
export function isPreviewableFile(fileType: string | null | undefined): boolean {
  return fileType === FileTypes.PDF || fileType === FileTypes.JPG || fileType === FileTypes.PNG;
}

function ascii(buf: Buffer, start: number, len: number): string {
  return buf.subarray(start, start + len).toString('latin1');
}

function hasBytes(buf: Buffer, offset: number, bytes: number[]): boolean {
  if (buf.length < offset + bytes.length) return false;
  return bytes.every((b, i) => buf[offset + i] === b);
}

const ZIP_SIGNATURE = [0x50, 0x4b, 0x03, 0x04];
const DOCX_MARKER = '[Content_Types].xml'; // обязательная часть OOXML (docx) внутри ZIP

/** Определяет тип по первым байтам (окно до 256 КБ достаточно для всех разрешённых форматов). */
function sniff(buffer: Buffer): FileType | undefined {
  if (hasBytes(buffer, 0, [0x25, 0x50, 0x44, 0x46]) && ascii(buffer, 1, 3) === 'PDF') return FileTypes.PDF;
  if (hasBytes(buffer, 0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return FileTypes.PNG;
  if (hasBytes(buffer, 0, [0xff, 0xd8, 0xff])) return FileTypes.JPG;
  // MP4: box 'ftyp' на смещении 4.
  if (buffer.length >= 12 && ascii(buffer, 4, 4) === 'ftyp') return FileTypes.MP4;
  // DOCX — ZIP-архив с маркером OOXML в первых 256 КБ.
  if (
    hasBytes(buffer, 0, ZIP_SIGNATURE) &&
    buffer.subarray(0, 256 * 1024).includes(Buffer.from(DOCX_MARKER, 'latin1'))
  ) {
    return FileTypes.DOCX;
  }
  return undefined;
}

/** Санитизирует имя файла (без путей и управляющих символов). */
export function safeOriginalName(filename: string): string {
  const trimmed = String(filename ?? '').trim();
  const base = (trimmed.split(/[/\\]/).pop() ?? '').replace(/[\u0000-\u001f\u007f]/g, '');
  return base.length > 200 ? base.slice(0, 200) : base;
}

/**
 * Проверяет содержимое и расширение. Возвращает токен типа либо бросает 415.
 * При несовпадении содержимого и расширения файл отклоняется.
 */
export function validateUpload(buffer: Buffer, originalName: string): FileType {
  const name = safeOriginalName(originalName);
  const dot = name.lastIndexOf('.');
  const rawExt = dot === -1 ? '' : name.slice(dot + 1).toLowerCase();
  const declaredType = EXTENSION_TO_TYPE[rawExt];
  if (!declaredType) {
    throw httpError(
      415,
      `Тип файла не поддерживается. Разрешены: ${ALLOWED_TYPES.join(', ')}`,
      'UNSUPPORTED_FILE_TYPE',
    );
  }

  const detected = sniff(buffer);
  if (!detected) {
    throw httpError(415, 'Содержимое файла не распознано или повреждено', 'INVALID_FILE_CONTENT');
  }
  if (detected !== declaredType) {
    throw httpError(
      415,
      `Содержимое файла не соответствует расширению (.${rawExt}). Проверьте файл.`,
      'FILE_CONTENT_MISMATCH',
    );
  }

  return detected;
}
