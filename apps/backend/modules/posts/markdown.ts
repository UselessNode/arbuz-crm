// Рендер Markdown → безопасный HTML (санитизация на сервере).
// Произвольный HTML от клиента не принимаем: только Markdown, который
// преобразуется здесь и очищается от опасных тегов/атрибутов.
import { marked } from 'marked';
import sanitizeHtml from 'sanitize-html';

const ALLOWED_TAGS = [
  'p', 'br', 'hr', 'strong', 'b', 'em', 'i', 'del', 's',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'ul', 'ol', 'li', 'blockquote',
  'code', 'pre', 'a', 'img',
  'table', 'thead', 'tbody', 'tr', 'th', 'td',
];

export function renderMarkdown(content: string): string {
  const raw = marked.parse(content ?? '', { async: false }) as string;
  return sanitizeHtml(raw, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: {
      a: ['href', 'title'],
      img: ['src', 'alt', 'title'],
    },
    allowedSchemes: ['http', 'https', 'mailto'],
    transformTags: {
      a: sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer' }),
    },
  });
}
