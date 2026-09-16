// Разбор HTML публикации на блоки: обычный HTML и галереи изображений.
//
// Бэкенд собирает несколько подряд идущих картинок в блок `post-gallery`
// (см. `apps/backend/modules/posts/markdown.ts`). Здесь блок разрезается на части,
// чтобы галерею можно было отрисовать компонентом `Carousel`, а не голым HTML.
//
// Логика чистая (без DOM) — покрыта смоук-тестом.

/** Класс блока галереи (совпадает со значением на бэкенде). */
export const POST_GALLERY_CLASS = 'post-gallery';

export interface PostGalleryImage {
  src: string;
  alt: string;
}

export type PostContentBlock =
  | { kind: 'html'; html: string }
  | { kind: 'gallery'; images: PostGalleryImage[] };

const GALLERY_PATTERN = new RegExp(`<div class="${POST_GALLERY_CLASS}">([\\s\\S]*?)</div>`, 'g');
const IMG_TAG = /<img\b([^>]*)>/g;
const ATTRIBUTE = /([\w-]+)="([^"]*)"/g;

/** Разбирает содержимое публикации на блоки в порядке следования. */
export function splitPostContent(html: string): PostContentBlock[] {
  const blocks: PostContentBlock[] = [];
  let cursor = 0;
  for (let match = GALLERY_PATTERN.exec(html); match; match = GALLERY_PATTERN.exec(html)) {
    const before = html.slice(cursor, match.index);
    if (before.trim()) blocks.push({ kind: 'html', html: before });
    const images = parseImages(match[1]);
    // Пустая галерея (картинки вычищены санитайзером) не должна давать пустую карусель.
    if (images.length > 0) blocks.push({ kind: 'gallery', images });
    cursor = match.index + match[0].length;
  }
  const tail = html.slice(cursor);
  if (tail.trim()) blocks.push({ kind: 'html', html: tail });
  return blocks;
}

/** Достаёт `src`/`alt` из тегов `<img>` внутри блока галереи. */
export function parseImages(inner: string): PostGalleryImage[] {
  const images: PostGalleryImage[] = [];
  for (let match = IMG_TAG.exec(inner); match; match = IMG_TAG.exec(inner)) {
    const attributes: Record<string, string> = {};
    for (let attribute = ATTRIBUTE.exec(match[1]); attribute; attribute = ATTRIBUTE.exec(match[1])) {
      attributes[attribute[1].toLowerCase()] = attribute[2];
    }
    const src = attributes.src ?? '';
    if (!src) continue;
    images.push({ src, alt: attributes.alt ?? '' });
  }
  return images;
}
