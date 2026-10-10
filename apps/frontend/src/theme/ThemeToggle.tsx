// Переключатель светлой/тёмной темы. Показывает иконку темы, на которую переключит.
import { Icon } from '../components/ui';
import { useTheme } from './ThemeContext';

export interface ThemeToggleProps {
  className?: string;
}

export function ThemeToggle({ className }: ThemeToggleProps) {
  const { theme, toggleTheme } = useTheme();
  const next = theme === 'dark' ? 'светлую' : 'тёмную';
  return (
    <button
      type="button"
      className={className}
      onClick={toggleTheme}
      aria-label={`Включить ${next} тему`}
      title={`Включить ${next} тему`}
    >
      <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={16} />
    </button>
  );
}
