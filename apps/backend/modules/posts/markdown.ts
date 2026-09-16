// Рендер Markdown → безопасный HTML (санитизация на сервере).
// Произвольный HTML от клиента не принимаем: только Markdown, который
// преобразуется здесь и очищается от опасных тегов/атрибутов.
//
// Редактор (MDXEditor) пишет Markdown расширенного набора, поэтому здесь есть:
//   • подсветка `==текст==` (GFM-совместимого синтаксиса нет — расширение marked);
//   • выноски GitHub-стиля `> [!NOTE]` … — блокquote с классом callout-*;
//   • строчный HTML `<u>`, `<sup>`, `<sub>` (так редактор сохраняет эти форматы);
//   • галерея: несколько подряд идущих картинок собираются в блок `post-gallery`,
//     который фронтенд показывает каруселью (отдельный синтаксис автору не нужен —
//     достаточно вставить несколько изображений подряд).
import {
  marked,
  type RendererExtension,
  type Token,
  type TokenizerExtension,
  type Tokens,
} from 'marked';
import sanitizeHtml from 'sanitize-html';

/** Класс блока галереи: используется фронтендом для сборки карусели. */
export const POST_GALLERY_CLASS = 'post-gallery';

const ALLOWED_TAGS = [
  'p', 'br', 'hr', 'strong', 'b', 'em', 'i', 'del', 's',
  'u', 'mark', 'sup', 'sub',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'ul', 'ol', 'li', 'blockquote',
  'code', 'pre', 'a', 'img',
  'table', 'thead', 'tbody', 'tr', 'th', 'td',
  // Чек-листы GFM: marked отдаёт их как отключённые чек-боксы.
  'input',
];

/** Типы выносок: `> [!NOTE]` → `<blockquote class="callout callout-note">`. */
const CALLOUT_TYPES = ['note', 'tip', 'important', 'warning', 'caution'] as const;
const CALLOUT_PATTERN = new RegExp(`^<p>\\s*\\[!(${CALLOUT_TYPES.map((type) => type.toUpperCase()).join('|')})\\]\\s*\\n?`, 'i');

interface HighlightToken extends Tokens.Generic {
  type: 'highlight';
  raw: string;
  tokens: Token[];
}

/** Подсветка `==текст==` (синтаксис пакета micromark-extension-highlight-mark). */
const highlightExtension: TokenizerExtension & RendererExtension = {
  name: 'highlight',
  level: 'inline',
  start(src) {
    return src.indexOf('==');
  },
  tokenizer(src) {
    const match = /^==(?=\S)([\s\S]*?\S)==/.exec(src);
    if (!match) return undefined;
    // Содержимое разбираем в собственный список токенов токена:
    // передавать сюда родительский список нельзя — получится бесконечная рекурсия.
    const token: HighlightToken = { type: 'highlight', raw: match[0], tokens: [] };
    this.lexer.inlineTokens(match[1], token.tokens);
    return token;
  },
  renderer(token) {
    return `<mark>${this.parser.parseInline((token as HighlightToken).tokens)}</mark>`;
  },
};

marked.use({
  extensions: [highlightExtension],
  renderer: {
    // Выноска: первый абзац начинается с маркера [!TYPE].
    blockquote(token: Tokens.Blockquote) {
      const body = this.parser.parse(token.tokens);
      const match = CALLOUT_PATTERN.exec(body);
      if (!match) return `<blockquote>\n${body}</blockquote>\n`;
      const type = match[1].toLowerCase();
      return `<blockquote class="callout callout-${type}">${body.slice(match[0].length)}</blockquote>\n`;
    },
  },
});

/** Рендер Markdown → безопасный HTML для публичной ленты. */
export function renderMarkdown(content: string): string {
  const raw = marked.parse(content ?? '', { async: false }) as string;
  const safe = sanitizeHtml(raw, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: {
      // `rel` нужен: его добавляет transformTags ниже, а атрибуты фильтруются после трансформации.
      a: ['href', 'title', 'rel'],
      img: ['src', 'alt', 'title'],
      // Класс выноски — единственный служебный класс в выводе.
      blockquote: ['class'],
      input: ['type', 'checked', 'disabled'],
    },
    allowedSchemes: ['http', 'https', 'mailto'],
    transformTags: {
      a: sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer' }),
    },
  });
  // Обёртка галереи добавляется ПОСЛЕ санитайзера: это наш собственный тег,
  // а не пользовательский HTML, поэтому разрешать `div` целиком не требуется.
  return groupImageParagraphs(safe);
}

/**
 * Собирает подряд идущие абзацы, состоящие только из картинок, в один блок галереи.
 * Одиночная картинка остаётся как есть — галерея появляется от двух изображений.
 */
export function groupImageParagraphs(html: string): string {
  const imageParagraph = /<p>\s*((?:<img\b[^>]*>\s*)+)<\/p>/g;
  const imageTag = /<img\b[^>]*>/g;

  const matches: Array<{ start: number; end: number; images: string[] }> = [];
  for (let match = imageParagraph.exec(html); match; match = imageParagraph.exec(html)) {
    matches.push({
      start: match.index,
      end: match.index + match[0].length,
      images: match[1].match(imageTag) ?? [],
    });
  }
  if (matches.length === 0) return html;

  // Соседние абзацы считаем одной галереей, если между ними только пробельные символы.
  const runs: Array<{ start: number; end: number; images: string[] }> = [];
  for (const item of matches) {
    const previous = runs[runs.length - 1];
    if (previous && html.slice(previous.end, item.start).trim() === '') {
      previous.end = item.end;
      previous.images.push(...item.images);
    } else {
      runs.push({ start: item.start, end: item.end, images: [...item.images] });
    }
  }

  let result = '';
  let cursor = 0;
  for (const run of runs) {
    if (run.images.length < 2) continue;
    result += html.slice(cursor, run.start);
    result += `<div class="${POST_GALLERY_CLASS}">${run.images.join('')}</div>`;
    cursor = run.end;
  }
  return result + html.slice(cursor);
}
