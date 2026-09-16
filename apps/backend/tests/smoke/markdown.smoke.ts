// Смоук: рендер Markdown публикаций → безопасный HTML.
//
// Проверяет расширения, которые нужны редактору (подсветка `==…==`, выноски
// `> [!NOTE]`, строчный HTML `<u>/<sup>/<sub>`, чек-листы), сборку галереи
// из подряд идущих картинок и то, что опасный ввод вычищается санитайзером.
// Чистая функция — без БД.
import { renderMarkdown } from '../../modules/posts/markdown';
import { createSmoke } from '../helpers/smoke';

const smoke = createSmoke('markdown (рендер публикаций)');

function main(): void {
  // Базовое форматирование.
  smoke.ok('жирный', renderMarkdown('**текст**').includes('<strong>текст</strong>'));
  smoke.ok('курсив', renderMarkdown('*текст*').includes('<em>текст</em>'));
  smoke.ok('зачёркивание', renderMarkdown('~~текст~~').includes('<del>текст</del>'));
  smoke.ok('строчный код', renderMarkdown('`код`').includes('<code>код</code>'));

  // Форматы, которые MDXEditor сохраняет как строчный HTML.
  smoke.ok('подчёркивание сохраняется', renderMarkdown('<u>текст</u>').includes('<u>текст</u>'));
  smoke.ok('верхний индекс сохраняется', renderMarkdown('x<sup>2</sup>').includes('<sup>2</sup>'));
  smoke.ok('нижний индекс сохраняется', renderMarkdown('H<sub>2</sub>O').includes('<sub>2</sub>O'));

  // Подсветка — нестандартный синтаксис, его добавляет расширение marked.
  smoke.ok('подсветка ==…==', renderMarkdown('==важно==').includes('<mark>важно</mark>'));

  // Чек-листы GFM: marked отдаёт отключённые чек-боксы, тег input разрешён.
  const checklist = renderMarkdown('- [x] сделано\n- [ ] в работе');
  smoke.ok('чек-лист: чек-боксы на месте', checklist.includes('type="checkbox"'), checklist);
  smoke.ok('чек-лист: отмеченный пункт сохранён', checklist.includes('checked'), checklist);

  // Таблицы.
  const table = renderMarkdown('| A | B |\n| --- | --- |\n| 1 | 2 |');
  smoke.ok('таблица', table.includes('<table>') && table.includes('<td>1</td>'), table);

  // Выноски GitHub-стиля.
  const warn = renderMarkdown('> [!WARNING]\n> Проверьте данные');
  smoke.ok('выноска: класс по типу', warn.includes('class="callout callout-warning"'), warn);
  smoke.ok('выноска: текст сохранён', warn.includes('Проверьте данные'), warn);
  smoke.ok('обычная цитата без класса', !renderMarkdown('> просто цитата').includes('callout'));
  smoke.ok('выноска не ломает обычную цитату', renderMarkdown('> просто цитата').includes('<blockquote>'));

  // Галерея: несколько картинок подряд собираются в один блок для карусели.
  const galleryImages = renderMarkdown('![раз](https://example.com/1.png)\n\n![два](https://example.com/2.png)');
  smoke.ok('галерея: блок создан', galleryImages.includes('<div class="post-gallery">'), galleryImages);
  smoke.ok(
    'галерея: обе картинки внутри блока',
    galleryImages.includes('1.png') && galleryImages.includes('2.png'),
    galleryImages,
  );
  smoke.ok('галерея: тег p больше не оборачивает картинки', !galleryImages.includes('<p><img'), galleryImages);

  const inlineImages = renderMarkdown('![a](https://example.com/a.png)\n![b](https://example.com/b.png)');
  smoke.ok('галерея: картинки в одном абзаце тоже собираются', inlineImages.includes('<div class="post-gallery">'), inlineImages);

  // Одиночная картинка галереей не становится.
  const singleImage = renderMarkdown('![одна](https://example.com/solo.png)');
  smoke.ok('одиночная картинка: без галереи', !singleImage.includes('post-gallery'), singleImage);
  smoke.ok('одиночная картинка: тег img на месте', singleImage.includes('solo.png'), singleImage);

  // Картинка в тексте абзаца — не галерея.
  const imageWithText = renderMarkdown('Текст ![фото](https://example.com/1.png) и продолжение');
  smoke.ok('картинка внутри текста: без галереи', !imageWithText.includes('post-gallery'), imageWithText);

  // Галереи разделяются обычным текстом, а не сливаются в одну.
  const twoGalleries = renderMarkdown(
    '![a](https://example.com/a.png)\n\n![b](https://example.com/b.png)\n\nМежду ними текст\n\n![c](https://example.com/c.png)\n\n![d](https://example.com/d.png)',
  );
  smoke.eq('две галереи разделены текстом', (twoGalleries.match(/post-gallery/g) ?? []).length, 2);

  // Порядок в галерее не меняется.
  const ordered = renderMarkdown('![1](https://example.com/1.png)\n\n![2](https://example.com/2.png)\n\n![3](https://example.com/3.png)');
  smoke.ok(
    'галерея: порядок картинок сохранён',
    ordered.indexOf('1.png') < ordered.indexOf('2.png') && ordered.indexOf('2.png') < ordered.indexOf('3.png'),
    ordered,
  );

  // Безопасность: скрипты, опасные схемы и обработчики вычищаются.
  smoke.ok('script вырезан', !renderMarkdown('<script>alert(1)</script>').includes('<script'));
  smoke.ok('onerror вырезан', !renderMarkdown('<img src="x" onerror="alert(1)">').includes('onerror'));
  smoke.ok('javascript: вырезан', !renderMarkdown('[ссылка](javascript:alert(1))').includes('javascript:'));
  smoke.ok('внешняя ссылка получает rel', renderMarkdown('[сайт](https://example.com)').includes('rel="noopener noreferrer"'));

  smoke.done();
}

main();
