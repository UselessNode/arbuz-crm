// Корень приложения: провайдеры темы, тостов и центра уведомлений, маршрутизация.
import { ToastProvider } from './components/ui';
import { ThemeProvider } from './theme/ThemeContext';
import { NotificationsProvider } from './notifications/NotificationsContext';
import { AppRouter } from './router/AppRouter';
import { useAppBackgroundPattern } from './theme/use-app-background-pattern';

/** Внутри ThemeProvider: подключает фоновый паттерн «семечки» из текущей темы. */
function AppShell() {
  useAppBackgroundPattern();
  return (
    <ToastProvider>
      <NotificationsProvider>
        <AppRouter />
      </NotificationsProvider>
    </ToastProvider>
  );
}

export function App() {
  return (
    <ThemeProvider>
      <AppShell />
    </ThemeProvider>
  );
}
