// Рендер текста подсказки раздела: поддерживает markdown-ссылки [подпись](url)
// и «голые» URL. Ссылки открываются в новой вкладке.
import type { ReactNode } from 'react';
import styles from './Applications.module.css';

const LINK_RE = /\[([^\]]+)\]\(([^)\s]+)\)|(https?:\/\/[^\s<>()]+)/g;

export function renderSectionHintText(text: string): ReactNode {
  const nodes: ReactNode[] = [];
  let last = 0;
  let key = 0;
  for (const match of text.matchAll(LINK_RE)) {
    const index = match.index ?? 0;
    if (index > last) nodes.push(text.slice(last, index));
    const [full, label, markdownUrl, bareUrl] = match;
    const href = markdownUrl ?? bareUrl ?? '';
    nodes.push(
      <a key={`link-${key++}`} href={href} target="_blank" rel="noopener noreferrer" className={styles.hintLink}>
        {label ?? bareUrl}
      </a>,
    );
    last = index + full.length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}
