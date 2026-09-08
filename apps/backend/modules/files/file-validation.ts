// Проверка загружаемых файлов: допустимые типы (PDF, DOCX, JPEG, PNG, MP4)
// по «магическим байтам» и расширению. Никакого выполнения содержимого.
import path from 'node:path';
import { httpError } from '../../lib/http';

export interface DetectedFile {
  ext: string; // нормализованное расширение для имени на диске
  mime: string;
}

export const ALLOWED_EXTENSIONS = ['pdf', 'docx', 'jpg', 'jpeg', 'png', 'mp4'] as const;

const MIME_BY_EXT: Record<string, string> = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  mp4: 'video/mp4',
};

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
function sniff(buffer: Buffer): string | undefined {
  if (hasBytes(buffer, 0, [0x25, 0x50, 0x44, 0x46]) && ascii(buffer, 1, 3) === 'PDF') return 'pdf';
  if (hasBytes(buffer, 0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'png';
  if (hasBytes(buffer, 0, [0xff, 0xd8, 0xff])) return 'jpg';
  // MP4: box 'ftyp' на смещении 4.
  if (buffer.length >= 12 && ascii(buffer, 4, 4) === 'ftyp') return 'mp4';
  // DOCX — ZIP-архив с маркером OOXML в первых 256 КБ.
  if (
    hasBytes(buffer, 0, ZIP_SIGNATURE) &&
    buffer.subarray(0, 256 * 1024).includes(Buffer.from(DOCX_MARKER, 'latin1'))
  ) {
    return 'docx';
  }
  return undefined;
}

/** Санитизирует имя файла (без путей и управляющих символов) и возвращает расширение. */
export function safeOriginalName(filename: string): string {
  const base = path.basename(String(filename ?? '').trim()).replace(/[\u0000-\u001f\u007f]/g, '');
  return base.length > 200 ? base.slice(0, 200) : base;
}

/**
 * Проверяет содержимое и расширение. Возвращает тип файла либо бросает 415.
 * При mismatch содержимого и расширения файл отклоняется.
 */
export function validateUpload(buffer: Buffer, originalName: string): DetectedFile {
  const name = safeOriginalName(originalName);
  const dot = name.lastIndexOf('.');
  const rawExt = dot === -1 ? '' : name.slice(dot + 1).toLowerCase();
  if (!(rawExt in MIME_BY_EXT)) {
    throw httpError(415, `Тип файла не поддерживается. Разрешены: ${ALLOWED_EXTENSIONS.join(', ')}`, 'UNSUPPORTED_FILE_TYPE');
  }

  const detected = sniff(buffer);
  if (!detected || !(detected in MIME_BY_EXT)) {
    throw httpError(415, 'Содержимое файла не распознано или повреждено', 'INVALID_FILE_CONTENT');
  }
  if (MIME_BY_EXT[detected] !== MIME_BY_EXT[rawExt]) {
    throw httpError(
      415,
      `Содержимое файла не соответствует расширению (.${rawExt}). Переименование файла не поможет — проверьте файл.`,
      'FILE_CONTENT_MISMATCH',
    );
  }

  // Для имён на диске используем расширение, которым файл опознан (jpg для jpeg/jpg).
  return { ext: detected, mime: MIME_BY_EXT[detected] };
}

export function isImageOrPdf(mime: string): boolean {
  return mime === 'application/pdf' || mime.startsWith('image/');
}
