// Корень приложения: провайдеры тостов и центра уведомлений, маршрутизация.
import { ToastProvider } from './components/ui';
import { NotificationsProvider } from './notifications/NotificationsContext';
import { AppRouter } from './router/AppRouter';

export function App() {
  return (
    <ToastProvider>
      <NotificationsProvider>
        <AppRouter />
      </NotificationsProvider>
    </ToastProvider>
  );
}
