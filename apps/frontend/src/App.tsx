// Корень приложения: провайдер уведомлений и маршрутизация.
import { ToastProvider } from './components/ui';
import { AppRouter } from './router/AppRouter';

export function App() {
  return (
    <ToastProvider>
      <AppRouter />
    </ToastProvider>
  );
}
