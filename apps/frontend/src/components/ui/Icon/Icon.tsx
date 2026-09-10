// Иконка. Источники:
// 1) кастомные SVG из src/assets/icons/*.svg (подключаются автоматически через import.meta.glob);
//    ожидается stroke="currentColor" (цвет наследуется от родителя);
// 2) небольшой inline-фолбэк для имён, которых нет в ассетах, но использует код.
import type { ReactNode } from 'react';
import styles from './Icon.module.css';

const rawModules = import.meta.glob('../../../assets/icons/*.svg', {
  eager: true,
  query: '?raw',
  import: 'default',
}) as Record<string, string>;

const CUSTOM_SVG: Record<string, string> = {};
for (const [path, content] of Object.entries(rawModules)) {
  const normalized = path.replace(/\\/g, '/');
  const name = normalized.split('/').pop()!.replace(/\.svg$/, '');
  CUSTOM_SVG[name] = content;
}

// Синонимы имён (например «file» → кастомный «document»).
const ALIASES: Record<string, string> = {
  file: 'document',
};

const FALLBACK: Record<string, ReactNode> = {
  'chevron-up': <polyline points="18 15 12 9 6 15" />,
  'chevron-right': <polyline points="9 18 15 12 9 6" />,
  minus: <line x1="5" y1="12" x2="19" y2="12" />,
  mail: (
    <>
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <polyline points="22,6 12,13 2,6" />
    </>
  ),
  lock: (
    <>
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </>
  ),
  upload: (
    <>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </>
  ),
  drag: (
    <>
      <line x1="9" y1="5" x2="9" y2="19" />
      <line x1="15" y1="5" x2="15" y2="19" />
    </>
  ),
};

export type IconName = string;

/** Все доступные имена иконок (кастомные + синонимы + фолбэк). */
export const ICON_NAMES: string[] = [...Object.keys(CUSTOM_SVG), ...Object.keys(ALIASES), ...Object.keys(FALLBACK)];

export interface IconProps {
  name: string;
  size?: number;
  className?: string;
}

export function Icon({ name, size = 16, className }: IconProps) {
  const resolved = ALIASES[name] ?? name;
  const raw = CUSTOM_SVG[resolved];
  const fallback = FALLBACK[resolved];
  const cls = className ? `${styles.icon} ${className}` : styles.icon;

  if (raw) {
    return (
      <span className={cls} style={{ width: size, height: size }} aria-hidden="true" dangerouslySetInnerHTML={{ __html: raw }} />
    );
  }

  if (fallback) {
    return (
      <span className={cls} style={{ width: size, height: size }} aria-hidden="true">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          className={styles.svg}
        >
          {fallback}
        </svg>
      </span>
    );
  }

  return null;
}
