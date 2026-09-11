// Иконка. Кастомные SVG лежат в src/assets/icons/*.svg и подключаются автоматически
// через import.meta.glob; в файлах ожидается stroke="currentColor" (цвет наследуется
// от родителя) и viewBox="0 0 24 24".
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

export type IconName = string;

/** Имена, о которых уже предупреждали (чтобы не спамить в консоль). */
const warnedNames = new Set<string>();

/** Все доступные имена иконок. */
export const ICON_NAMES: string[] = Object.keys(CUSTOM_SVG).sort();

export interface IconProps {
  name: string;
  size?: number;
  className?: string;
}

export function Icon({ name, size = 16, className }: IconProps) {
  const raw = CUSTOM_SVG[name];
  const cls = className ? `${styles.icon} ${className}` : styles.icon;

  if (raw) {
    return (
      <span className={cls} style={{ width: size, height: size }} aria-hidden="true" dangerouslySetInnerHTML={{ __html: raw }} />
    );
  }

  if (import.meta.env.DEV && !warnedNames.has(name)) {
    warnedNames.add(name);
    console.warn(`[Icon] Неизвестное имя иконки: "${name}"`);
  }
  return null;
}
