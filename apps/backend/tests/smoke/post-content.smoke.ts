// Смоук: разбор HTML публикации на блоки (обычный HTML + галереи для карусели).
//
// Бэкенд собирает подряд идущие картинки в блок `post-gallery`; фронтенд разрезает
// содержимое по нему, чтобы показать галерею компонентом `Carousel`.
// Логика чистая (без DOM) — живёт в `apps/frontend/src/lib/post-content.ts`.
import { POST_GALLERY_CLASS, parseImages, splitPostContent } from '../../../frontend/src/lib/post-content';
import { createSmoke } from '../helpers/smoke';

const smoke = createSmoke('post-content (блоки публикации)');

function main(): void {
  // Только текст — один HTML-блок.
  const textOnly = splitPostContent('<p>Просто текст</p>');
  smoke.eq('только текст: один блок', textOnly.length, 1);
  smoke.eq('только текст: тип блока', textOnly[0].kind, 'html');

  // Текст + галерея + текст: три блока в исходном порядке.
  const html =
    `<p>До</p><div class="${POST_GALLERY_CLASS}">` +
    '<img src="/api/posts/1/files/1/download" alt="первое">' +
    '<img src="/api/posts/1/files/2/download" alt="второе">' +
    '</div><p>После</p>';
  const blocks = splitPostContent(html);
  smoke.eq('текст и галерея: три блока', blocks.length, 3);
  smoke.eq('текст и галерея: порядок блоков', blocks.map((block) => block.kind), ['html', 'gallery', 'html']);

  const gallery = blocks[1];
  smoke.ok('галерея: тип блока', gallery.kind === 'gallery');
  if (gallery.kind === 'gallery') {
    smoke.eq('галерея: две картинки', gallery.images.length, 2);
    smoke.eq('галерея: адрес первой', gallery.images[0].src, '/api/posts/1/files/1/download');
    smoke.eq('галерея: подпись второй', gallery.images[1].alt, 'второе');
  }

  // Галерея без картинок не должна давать пустую карусель.
  const empty = splitPostContent(`<div class="${POST_GALLERY_CLASS}"></div>`);
  smoke.eq('пустая галерея пропускается', empty.length, 0);

  // Картинка без src отбрасывается, остальные сохраняются.
  const withoutSrc = parseImages('<img alt="нет адреса"><img src="/ok.png" alt="есть">');
  smoke.eq('картинка без src отброшена', withoutSrc.length, 1);
  smoke.eq('оставшаяся картинка разобрана', withoutSrc[0].src, '/ok.png');

  // Обычный HTML с картинкой (без галереи) остаётся единым блоком.
  const plainImage = splitPostContent('<p><img src="/solo.png" alt="одна"></p>');
  smoke.eq('одиночная картинка: один html-блок', plainImage.length, 1);
  smoke.eq('одиночная картинка: тип блока', plainImage[0].kind, 'html');

  // Пустая строка не даёт пустых блоков.
  smoke.eq('пустой ввод: блоков нет', splitPostContent('').length, 0);

  smoke.done();
}

main();
