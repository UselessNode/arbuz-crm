// C:\project\arbuz-crm\apps\frontend\vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    // Явный IPv4: по умолчанию Vite слушает только [::1] (IPv6),
    // и браузер не может открыть localhost, если ходит по IPv4.
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    // Проксируем запросы к API на backend (apps/backend, порт 3000).
    proxy: {
      '/health': 'http://127.0.0.1:3000',
      '/api': 'http://127.0.0.1:3000',
    },
  },
});
