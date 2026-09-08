// C:\project\arbuz-crm\apps\frontend\vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Проксируем запросы к API на backend (apps/backend, порт 3000).
    proxy: {
      '/health': 'http://localhost:3000',
      '/api': 'http://localhost:3000',
    },
  },
});
