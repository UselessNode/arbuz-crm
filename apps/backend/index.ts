// C:\project\arbuz-crm\apps\backend\index.ts
import express from 'express';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@arbuz/shared';

const app = express();
const port = Number(process.env.PORT) || 3000;

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('[Backend] DATABASE_URL не задан. Добавьте его в .env в корне репозитория.');
  process.exit(1);
}

// Prisma 7 подключается к PostgreSQL через driver adapter.
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

app.use(express.json());

app.get('/', (_req, res) => {
  res.json({ name: 'Arbuz CRM API', status: 'running' });
});

// Проверка живости сервиса и доступности базы данных.
app.get('/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok', database: 'connected' });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(503).json({ status: 'degraded', database: 'unavailable', message });
  }
});

const server = app.listen(port, () => {
  console.log(`[Backend] запущен на http://localhost:${port}`);
});

async function shutdown() {
  await prisma.$disconnect();
  server.close(() => process.exit(0));
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
