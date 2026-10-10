// Устанавливает CSS-переменную `--app-bg-pattern` на <html> в зависимости от темы.
// Значения плитки берутся из CSS-токенов (см. tokens.css), тема задаёт только цвет.
import { useEffect } from 'react';
import { useTheme, type Theme } from './ThemeContext';
import { readSeedPatternTokens, seedPatternDataUrl, type SeedPatternOptions } from './seed-pattern';

/**
 * Читает токены паттерна для КОНКРЕТНОЙ темы.
 *
 * Порядок `useEffect` в React — снизу вверх (дети раньше родителей), поэтому
 * к моменту первого прогона этого эффекта `data-theme` от ThemeProvider может
 * быть ещё не выставлен. Чтобы не зависеть от порядка, временно гарантируем
 * нужный атрибут, читаем токены и возвращаем исходное значение.
 */
function readTokensForTheme(theme: Theme): SeedPatternOptions {
  const root = document.documentElement;
  const current = root.getAttribute('data-theme');
  if (current !== theme) root.setAttribute('data-theme', theme);
  const options = readSeedPatternTokens();
  if (current !== theme) root.setAttribute('data-theme', current ?? theme);
  return options;
}

export function useAppBackgroundPattern(): void {
  const { theme } = useTheme();

  useEffect(() => {
    const url = seedPatternDataUrl(readTokensForTheme(theme));
    document.documentElement.style.setProperty('--app-bg-pattern', url);
  }, [theme]);
}
