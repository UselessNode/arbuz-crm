// C:\project\arbuz-crm\packages\shared\index.ts
/*
 * «Шлюз» типов CRM-системы для всех воркспейсов монорепозитория.
 *
 * Prisma (см. prisma.config.ts и schema.prisma) генерирует клиент в
 * packages/shared/src/generated/prisma. Папка сгенерированного клиента
 * не хранится в git — перед запуском обязателен `bun db:generate`.
 *
 * Отсюда мы раздаём PrismaClient, типы моделей и enum'ы наружу
 * под именем @arbuz/shared.
 */
export * from './src/generated/prisma/index.js';
export * from './src/constants/posts.js';
