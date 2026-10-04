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
  /** Поворот относительно центра в градусах */
  rotate?: number;
  /** Отзеркалить по вертикали */
  flipVertical?: boolean;
  /** Отзеркалить по горизонтали */
  flipHorizontal?: boolean;
  /** Прозрачность от 0 до 1 */
  opacity?: number;
  /** Цвет фона контейнера иконки */
  backgroundColor?: string;
}

function buildTransform(props: Pick<IconProps, 'rotate' | 'flipVertical' | 'flipHorizontal'>): string | undefined {
  const parts: string[] = [];
  if (props.flipHorizontal) parts.push('scaleX(-1)');
  if (props.flipVertical) parts.push('scaleY(-1)');
  if (props.rotate != null && props.rotate !== 0) parts.push(`rotate(${props.rotate}deg)`);
  return parts.length ? parts.join(' ') : undefined;
}

export function Icon({
  name,
  size = 16,
  className,
  rotate,
  flipVertical,
  flipHorizontal,
  opacity,
  backgroundColor,
}: IconProps) {
  const raw = CUSTOM_SVG[name];
  const cls = className ? `${styles.icon} ${className}` : styles.icon;

  const transform = buildTransform({ rotate, flipVertical, flipHorizontal });

  const style: React.CSSProperties = {
    width: size,
    height: size,
    opacity: opacity ?? undefined,
    backgroundColor: backgroundColor ?? undefined,
    ...(transform ? { transform } : {}),
  };

  if (raw) {
    return (
      <span
        className={cls}
        style={style}
        aria-hidden="true"
        dangerouslySetInnerHTML={{ __html: raw }}
      />
    );
  }

  if (import.meta.env.DEV && !warnedNames.has(name)) {
    warnedNames.add(name);
    console.warn(`[Icon] Неизвестное имя иконки: "${name}"`);
  }
  return null;
}
