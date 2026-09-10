// Единая установка заголовков скачивания файлов (материалы заявки, вложения постов).
import type { Response } from 'express';
import { fileMime, isPreviewableFile } from './file-validation';

export function applyDownloadHeaders(
  res: Response,
  fileName: string | null,
  fileType: string | null,
  size: number,
): void {
  const disposition = isPreviewableFile(fileType) ? 'inline' : 'attachment';
  const encoded = encodeURIComponent(fileName ?? 'file');
  res.setHeader('Content-Type', fileMime(fileType));
  res.setHeader('Content-Length', String(size));
  res.setHeader('Content-Disposition', `${disposition}; filename*=UTF-8''${encoded}`);
  res.setHeader('X-Content-Type-Options', 'nosniff');
}
