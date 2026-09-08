// Точка входа: собирает приложение (createApp) и запускает HTTP-сервер.
import { createApp } from './app';
import { config } from './lib/config';
import { prisma } from './lib/prisma';
import { log } from './lib/logger';

const app = createApp();

const server = app.listen(config.port, () => {
  log.info('[Backend] запущен', { port: config.port, url: `http://127.0.0.1:${config.port}` });
});

async function shutdown(): Promise<void> {
  await prisma.$disconnect();
  server.close(() => process.exit(0));
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
