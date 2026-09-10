// Единый экземпляр Prisma Client для backend.
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@arbuz/shared';
import { config } from './config';

export const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: config.databaseUrl }),
});
