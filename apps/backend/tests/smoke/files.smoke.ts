// Смоук: проверка загружаемых файлов — санитизация имени, тип содержимого и расширение.
import {
  FileTypes,
  fileMime,
  isPreviewableFile,
  safeOriginalName,
  validateUpload,
} from '../../modules/files/file-validation';
import { createSmoke } from '../helpers/smoke';

const smoke = createSmoke('files (имя и тип загрузки)');

// Минимальные «валидные» буферы: детектор смотрит только сигнатуру.
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
const PDF = Buffer.from('%PDF-1.4');
const MP4 = Buffer.from([0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x6d, 0x70, 0x34, 0x32]);
const DOCX = Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.from('...[Content_Types].xml...')]);

async function main(): Promise<void> {
  // Имена файлов: без путей и управляющих символов.
  smoke.eq('путь в имени файла отбрасывается', safeOriginalName('..\\..\\etc\\passwd.txt'), 'passwd.txt');
  smoke.eq('имя с кириллицей сохраняется', safeOriginalName('отчёт за апрель (финал).pdf'), 'отчёт за апрель (финал).pdf');
  smoke.eq('управляющие символы удаляются', safeOriginalName('имя\u0000\u001f.pdf'), 'имя.pdf');
  smoke.ok('длинное имя обрезается до 200 символов', safeOriginalName('a'.repeat(300)).length === 200);

  // MIME и предпросмотр по сохранённому токену типа.
  smoke.eq('MIME для docx', fileMime(FileTypes.DOCX), 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  smoke.eq('MIME по умолчанию', fileMime(null), 'application/octet-stream');
  smoke.ok('PNG показывается inline', isPreviewableFile(FileTypes.PNG));
  smoke.ok('MP4 не показывается inline', !isPreviewableFile(FileTypes.MP4));

  // Содержимое и расширение должны совпадать.
  smoke.eq('PNG с расширением .png', validateUpload(PNG, 'схема.png'), FileTypes.PNG);
  smoke.eq('JPEG с расширением .JPEG', validateUpload(JPEG, 'фото.JPEG'), FileTypes.JPG);
  smoke.eq('PDF с расширением .pdf', validateUpload(PDF, 'заявка.pdf'), FileTypes.PDF);
  smoke.eq('DOCX с расширением .docx', validateUpload(DOCX, 'бюджет.docx'), FileTypes.DOCX);
  smoke.eq('MP4 с расширением .mp4', validateUpload(MP4, 'ролик.mp4'), FileTypes.MP4);

  await smoke.fails('несовпадение содержимого и расширения', async () => validateUpload(PNG, 'заявка.pdf'), 'FILE_CONTENT_MISMATCH');
  await smoke.fails('неразрешённое расширение', async () => validateUpload(PNG, 'скрипт.exe'), 'UNSUPPORTED_FILE_TYPE');
  await smoke.fails('нераспознанное содержимое', async () => validateUpload(Buffer.from('hello'), 'файл.pdf'), 'INVALID_FILE_CONTENT');

  smoke.done();
}

await main();
