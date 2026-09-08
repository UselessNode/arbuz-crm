// Точка входа backend: Express, маршруты аутентификации и файлов, проверка БД.
import express from 'express';
import { config } from './lib/config';
import { prisma } from './lib/prisma';
import { errorHandler, notFoundHandler } from './lib/http';
import { log } from './lib/logger';
import { authRouter } from './modules/auth/auth.routes';
import { filesRouter } from './modules/files/files.routes';

const app = express();
app.use(express.json());

app.get('/', (_req, res) => {
  res.json({ name: 'Arbuz CRM API', status: 'running', version: '1.0.3' });
});

app.get('/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok', database: 'connected' });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(503).json({ status: 'degraded', database: 'unavailable', message });
  }
});

app.use('/api/auth', authRouter);
app.use('/api/applications', filesRouter);

app.use(notFoundHandler);
app.use(errorHandler);

const server = app.listen(config.port, () => {
  log.info('[Backend] запущен', { port: config.port, url: `http://127.0.0.1:${config.port}` });
});

async function shutdown(): Promise<void> {
  await prisma.$disconnect();
  server.close(() => process.exit(0));
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
