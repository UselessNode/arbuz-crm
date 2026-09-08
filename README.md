# 🍉 Arbuz CRM

Монорепозиторий CRM-системы для управления заявками (гранты, тендеры, конкурсы): приём заявок, экспертные оценки, бюджеты и планы проектов, командный состав, файлы и согласия, публикации.

## Технологический стек

| Слой       | Технология                                                        |
| ---------- | ----------------------------------------------------------------- |
| Пакетный менеджер | [Bun](https://bun.sh) `1.4.2` (workspaces + рантайм для бэкенда)  |
| Язык       | TypeScript                                                        |
| Backend    | Express (`apps/backend`), Bun как рантайм                         |
| Frontend   | React 18 + Vite (`apps/frontend`)                                 |
| Общий пакет| `@arbuz/shared` — «шлюз» Prisma Client и типов для всех воркспейсов |
| БД / ORM   | PostgreSQL + [Prisma](https://www.prisma.io) `7` + driver adapter `@prisma/adapter-pg` |

## Структура монорепозитория

```
arbuz-crm/
├── apps/
│   ├── backend/                  # API-сервер @arbuz/backend (Express + Prisma)
│   │   ├── index.ts              # Точка входа: / и /health
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── frontend/                 # Веб-клиент @arbuz/frontend (React + Vite)
│       ├── index.html
│       ├── vite.config.ts        # Прокси на backend (порт 3000)
│       ├── src/
│       │   ├── main.tsx
│       │   ├── App.tsx           # Проверка связи с backend (/health)
│       │   └── index.css
│       ├── package.json
│       └── tsconfig.json
├── packages/
│   └── shared/                   # @arbuz/shared
│       ├── prisma/
│       │   ├── schema.prisma     # Схема БД
│       │   └── migrations/       # Миграции Prisma
│       ├── src/generated/prisma/ # Сгенерированный Prisma Client (не коммитится)
│       └── index.ts              # Реэкспорт клиента наружу
├── prisma.config.ts              # Конфигурация Prisma 7 (путь к схеме, миграции)
├── .env.example                  # Шаблон переменных окружения
├── bun.lock
└── package.json                  # Скрипты корня монорепозитория
```

Воркспейсы: `apps/*` и `packages/*`. Внутренняя зависимость — `@arbuz/shared` (`workspace:*`), в `tsconfig` подключается через paths.

## Требования

- [Bun](https://bun.sh) `1.4.2` — установить и добавить в `PATH`.
- PostgreSQL и `DATABASE_URL` в `.env` в корне репозитория (см. `.env.example`).

## Быстрый старт

```sh
# 1. Установить зависимости
bun install

# 2. Создать .env в корне (по образцу .env.example)
#    DATABASE_URL="postgresql://user:password@localhost:5432/arbuz_crm"

# 3. Сгенерировать Prisma Client (папка gitignored)
bun db:generate

# 4. Применить схему к БД (создаст таблицы)
bun db:push

# 5. Запустить frontend и backend одновременно
bun dev

# либо по отдельности
bun dev:backend   # http://localhost:3000
bun dev:frontend  # http://localhost:5173
```

> Примечание: `bun run build` (а не `bun build`) — имя скрипта конфликтует со встроенной командой bundler'а.

## Скрипты (корень `package.json`)

| Команда                | Назначение                                             |
| ---------------------- | ------------------------------------------------------ |
| `bun dev`              | Запуск frontend и backend параллельно (concurrently)   |
| `bun dev:backend`      | Backend в watch-режиме (env из `.env` через dotenv-cli)|
| `bun dev:frontend`     | Vite dev-сервер                                        |
| `bun typecheck`        | Проверка типов: shared → backend → frontend            |
| `bun typecheck:*`      | Проверка типов отдельного воркспейса                   |
| `bun run build`        | typecheck + сборка frontend                            |
| `bun db:push`          | Применить схему Prisma к БД (без миграций)             |
| `bun db:generate`      | Сгенерировать Prisma Client                            |
| `bun db:update`        | `db:push` + `db:generate`                              |
| `bun db:migrate`       | Создать/применить миграции (`prisma migrate dev`)      |

## База данных

- Схема: `packages/shared/prisma/schema.prisma` (PostgreSQL).
- Конфигурация Prisma 7 — в `prisma.config.ts` в корне (пути к схеме и миграциям, URL из `process.env.DATABASE_URL`).
- Генератор выводит клиент в `packages/shared/src/generated/prisma`; оттуда его реэкспортирует `packages/shared/index.ts` под именем `@arbuz/shared`.
- Сгенерированный клиент не хранится в git (см. `.gitignore`): после клонирования обязателен `bun db:generate`.
- Основные домены схемы:
  - **Пользователи и роли** — `users` (роли `admin`, `expert`, `applicant`).
  - **Тендеры и направления** — `tenders`, `directions`, критерии оценки `evaluation_criteria`.
  - **Заявки** — `applications`, статусы `application_statuses`, рецензии `application_reviews`.
  - **Содержимое заявки** — `project_plans`, `project_budget`, `team_members` + `consent_files`, материалы `additional_materials`.
  - **Прочее** — `files`/`file_categories`, `posts`, журнал `change_logs`.
- Конвенции: `snake_case`, мягкое удаление через `deleted_at`, частичные индексы `(deleted_at IS NULL)`.

## Текущее состояние (2026-09-08)

- ✅ `bun install`, `bun typecheck` (shared, backend, frontend) и `bun run build` проходят.
- ✅ Backend: Express-сервер, `GET /` и `GET /health` (проверка БД), корректное завершение по SIGINT/SIGTERM.
- ✅ Frontend: минимальное React-приложение на Vite с прокси на backend.
- ✅ Prisma Client генерируется (`bun db:generate`) и работает с PostgreSQL через `@prisma/adapter-pg`.
- ⚠️ `bun --watch` из `apps/backend` следит только за файлами пакета; правки в `packages/shared` требуют ручного перезапуска dev-сервера.
- ⚠️ Миграция `20260907120417_init` создана пустой (без `migration.sql`) — рабочая схема задаётся через `db:push`.
