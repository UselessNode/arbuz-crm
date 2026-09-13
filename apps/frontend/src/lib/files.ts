// Типы файлов, как они хранятся в БД (токены, см. backend/modules/files/file-validation.ts).
export type FileType = 'pdf' | 'docx' | 'jpg' | 'png' | 'mp4';

/** Картинку можно показать превью в интерфейсе. */
export function isImageFile(fileType: string | null | undefined): boolean {
  return fileType === 'jpg' || fileType === 'png';
}
