// Чтение multipart-запроса (один файл в поле "file" + опциональные поля).
// Вынесено из модуля files, т.к. используется также постами и pdf-экспортом.
import busboy from 'busboy';
import type { Request } from 'express';
import { config } from './config';
import { httpError } from './http';

export interface MultipartFile {
  buffer: Buffer;
  originalName: string;
  comment?: string;
}

export function readMultipartFile(req: Request): Promise<MultipartFile> {
  return new Promise((resolve, reject) => {
    const bb = busboy({
      headers: req.headers,
      limits: { files: 1, fileSize: config.limits.maxFileBytes + 1 },
    });
    const chunks: Buffer[] = [];
    const comments: string[] = [];
    let bytes = 0;
    let fileStarted = false;
    let duplicateFile = false;
    let tooLarge = false;
    let originalName = '';

    bb.on('file', (_field, stream, info) => {
      if (fileStarted) {
        duplicateFile = true;
        stream.resume();
        return;
      }
      fileStarted = true;
      originalName = String(info.filename ?? '');
      stream.on('data', (chunk: Buffer) => {
        bytes += chunk.length;
        if (!tooLarge) chunks.push(chunk);
        if (bytes > config.limits.maxFileBytes) tooLarge = true;
      });
      stream.on('error', reject);
    });
    bb.on('field', (field, value) => {
      if (field === 'comment') comments.push(value);
    });
    bb.on('error', reject);
    bb.on('close', () => {
      if (duplicateFile) {
        reject(httpError(400, 'За один запрос можно загрузить только один файл', 'ONE_FILE_PER_REQUEST'));
        return;
      }
      if (!fileStarted) {
        reject(httpError(400, 'Файл не передан (поле "file")', 'FILE_REQUIRED'));
        return;
      }
      if (tooLarge) {
        const mb = Math.floor(config.limits.maxFileBytes / (1024 * 1024));
        reject(
          httpError(413, `Файл превышает лимит ${mb} МБ. Уменьшите файл и попробуйте снова.`, 'FILE_TOO_LARGE'),
        );
        return;
      }
      resolve({
        buffer: Buffer.concat(chunks, bytes),
        originalName,
        comment: comments.length ? comments.join('\n') : undefined,
      });
    });
    req.pipe(bb);
  });
}
