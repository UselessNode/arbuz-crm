// Единый экземпляр Prisma Client для backend.
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@arbuz/shared';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('[prisma] DATABASE_URL не задан. Добавьте его в .env в корне репозитория.');
}

export const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});
