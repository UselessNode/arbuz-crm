// C:\project\arbuz-crm\prisma.config.ts
import { defineConfig } from "prisma/config";

export default defineConfig({
  // Указываем Prisma, где физически лежит схема в монорепозитории
  schema: "packages/shared/prisma/schema.prisma",

  // Указываем, куда сохранять файлы миграций
  migrations: {
    path: "packages/shared/prisma/migrations",
  },

  // Используем process.env напрямую. Bun автоматически подставит значение из .env
  datasource: {
    url: process.env.DATABASE_URL!,
  },
});
