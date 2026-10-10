// Фоновый паттерн «семечки» — тихий арбузный мотив под содержимым приложения.
//
// Источник формы — иконка `assets/icons/seed.svg` (viewBox 0 0 24 24). Её путь
// встраивается в SVG-плитку паттерна (data:URL), которая затем кладётся в
// CSS-переменную `--app-bg-pattern`. Переменная применяется только к фону
// приложения (см. index.css, `body`), поэтому карточки, формы, кнопки и шапки
// (у них собственный непрозрачный фон) паттерн перекрывают и остаются чистыми.
//
// Раскладка: три семечка по диагонали плитки (F-вариант), дублирование ±step
// для бесшовности. Все числовые параметры и цвет берутся из CSS-токенов
// (см. tokens.css, блок «Фоновый паттерн «семечки»») — единый источник настройки.

/** Путь семечка из assets/icons/seed.svg. */
const SEED_PATH = 'M12 2c2.8 4 5 8.5 5 12.5 0 4.5-2.2 7.5-5 7.5s-5-3-5-7.5C7 10.5 9.2 6 12 2Z';

/** viewBox исходной иконки. */
const VIEWBOX = 24;

export interface SeedPatternOptions {
  /** Шаг сетки в px (плотность): меньше — гуще. */
  step: number;
  /** Размер семечка в px. */
  size: number;
  /** Цвет заливки. */
  color: string;
  /** Прозрачность плитки (0..1). */
  opacity: number;
  /** Угол наклона семечек, градусы. */
  angle: number;
}

/** Позиции трёх семечек в плитке (в долях step) — диагональный ряд под 45°. */
const TILE_POSITIONS: ReadonlyArray<readonly [number, number]> = [
  [0.22, 0.24],
  [0.5, 0.5],
  [0.78, 0.76],
];

/** Собирает data:URL бесшовной SVG-плитки с семечками. */
export function seedPatternDataUrl(opts: SeedPatternOptions): string {
  const { step, size, color, opacity, angle } = opts;
  const scale = size / VIEWBOX;
  const parts: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${step}" height="${step}" viewBox="0 0 ${step} ${step}">`,
    `<g fill="${color}" opacity="${opacity}">`,
  ];

  for (const [fx, fy] of TILE_POSITIONS) {
    const px = fx * step;
    const py = fy * step;
    // 9 копий (±step по обеим осям) — узор не рвётся на стыках плиток.
    for (const dx of [-step, 0, step]) {
      for (const dy of [-step, 0, step]) {
        parts.push(
          `<g transform="translate(${px + dx} ${py + dy}) rotate(${angle}) scale(${scale}) translate(${-VIEWBOX / 2} ${-VIEWBOX / 2})">`,
          `<path d="${SEED_PATH}"/>`,
          `</g>`,
        );
      }
    }
  }

  parts.push('</g>', '</svg>');
  return `url("data:image/svg+xml,${encodeURIComponent(parts.join(''))}")`;
}

/**
 * CSS-токены паттерна из :root. В тёмной теме значения переопределены
 * (в частности `--bg-pattern-seed-color`), поэтому читаем их уже с учётом
 * активной темы.
 */
export function readSeedPatternTokens(): SeedPatternOptions {
  const style = getComputedStyle(document.documentElement);
  const num = (name: string, fallback: number): number => {
    const raw = style.getPropertyValue(name).trim();
    const parsed = Number.parseFloat(raw);
    return Number.isFinite(parsed) ? parsed : fallback;
  };
  const str = (name: string, fallback: string): string => {
    const raw = style.getPropertyValue(name).trim();
    return raw || fallback;
  };

  return {
    step: num('--bg-pattern-seed-step', 40),
    size: num('--bg-pattern-seed-size', 12),
    angle: num('--bg-pattern-seed-angle', 45),
    opacity: num('--bg-pattern-seed-opacity', 0.05),
    color: str('--bg-pattern-seed-color', '#12261b'),
  };
}
