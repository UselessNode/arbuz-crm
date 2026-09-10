# 🍉 Arbuz CRM

Монорепозиторий CRM-системы для управления заявками (направления, тендеры, конкурсы): приём заявок, экспертные оценки, бюджеты и планы проектов, командный состав, файлы и согласия, публикации.

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

## Установка

```sh
# 0. Клонировать репозиторий
git clone # <...>
cd ./arbuz-crm/

# 1. Установить зависимости
bun install

# 2. Настроить `.env` в корне (по образцу `.env.example`)
#    DATABASE_URL="postgresql://user:password@localhost:5432/arbuz_crm"
#    JWT_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD (для входа и seed)

# 3. Сгенерировать Prisma Client (папка gitignored)
bun db:generate

# 4. Применить схему к БД (создаст таблицы)
bun db:push

# 4.1. Опционально: тестовые данные
bun seed                    # или SEED_DEMO=true bun seed

# 5. Запустить frontend и backend одновременно
bun dev

# либо по отдельности
bun dev:backend    # http://127.0.0.1:3000
bun dev:frontend   # http://127.0.0.1:5173
```

> Vite явно слушает `127.0.0.1` (IPv4), чтобы страница открывалась в браузере по `localhost`.
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
| `bun seed`             | Начальное наполнение: администратор (+демо при `SEED_DEMO=true`) |
| `bun storage:cleanup`  | Очистка удалённых/осиротевших файлов (для cron)       |

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

## Файлы и аутентификация (API)

### Аутентификация

- `POST /api/auth/login` — вход по email/паролю, выдаёт JWT в httpOnly-cookie `arbuz_session`.
- `POST /api/auth/logout`, `GET /api/auth/me` — выход и текущий пользователь.
- Пароли: argon2id (`Bun.password`). В будущем возможны внешние провайдеры (Госуслуги/ВК) без изменения схемы.

### Файлы заявок

- Хранение: диск `./uploads/` (env `UPLOAD_DIR`). Папка заявки — `<owner_id>-<application_id>-<время>`; согласия — в подпапке `consents/`.
- В БД хранятся относительные пути; разрешены PDF, DOCX, JPEG, PNG, MP4 (проверка содержимого + расширения). Имена на диске — UUID.
- Лимиты: 10 МБ на файл, 25 МБ на все файлы заявки.
- Доступ: владелец заявки или администратор; файлы отдаются только через API.
- Материалы заявки (`additional_materials`): `POST/GET /api/applications/:id/files`, `GET .../files/:fileId/download`, `DELETE .../files/:fileId`.
- Согласия участников (`consent_files`): `GET/POST /api/applications/:id/team-members/:memberId/consents`, `GET .../consents/:consentId/download`, `DELETE .../consents/:consentId`.
- Посты (лента новостей): `GET/POST/PATCH/DELETE /api/posts[/:id]` (создание/правка/публикация — администратор; чтение опубликованного — все), вложения `POST/GET/DELETE /api/posts/:id/files[/:fileId][/download]`.
- Пользователи (только администратор): `GET/POST /api/users`, `GET/PATCH/DELETE /api/users/:id`, `POST /api/users/:id/reset-password`.
- Заявки (по ролям): `GET/POST /api/applications`, `GET/PATCH/DELETE /api/applications/:id`, `POST /api/applications/:id/submit`; состав — `GET/POST/PATCH/DELETE /api/applications/:id/team-members|project-plans|project-budget`.
- Справочники (только администратор): тендеры `/api/tenders`, критерии `/api/tenders/:id/criteria`, направления `/api/directions`, статусы `/api/application-statuses`.
- PDF-экспорт заявки (асинхронно, статус в `pdf_export_jobs`): `POST /api/applications/:id/pdf-export`, `GET /api/pdf-export-jobs/:jobId`, `GET .../download`.
- Известные «хвосты» и отложенные решения: `docs/technical-debt.md`.
- Аудит действий (вход, загрузка/скачивание/удаление) пишется в `logs/audit.log`.
- Очистка: `bun storage:cleanup` (например, в cron).
- Проверка API без опыта: готовая коллекция `postman/arbuz-crm.postman_collection.json`, инструкция — `docs/api-testing-postman.md`.
- Автотесты (unit + интеграционные, Postman Runner/Newman) — запланированы в график.

### Заметки для деплоя

- Каталог `uploads/` держать вне статики веб-сервера (файлы раздаёт только API): nginx не должен обслуживать его.
- Права на сервере: файлы `640`, каталоги `750`; запрет исполнения в `uploads/`.
- `JWT_SECRET` — длинная случайная строка; в production без него сервер не стартует.
- Резервное копирование: БД + `uploads/` (+ `logs/` при необходимости).

## Текущее состояние (2026-09-08)

- ✅ `bun install`, `bun typecheck` (shared, backend, frontend) и `bun run build` проходят.
- ✅ Backend: Express-сервер, `GET /` и `GET /health` (проверка БД), корректное завершение по SIGINT/SIGTERM.
- ✅ Frontend: минимальное React-приложение на Vite с прокси на backend.
- ✅ Prisma Client генерируется (`bun db:generate`) и работает с PostgreSQL через `@prisma/adapter-pg`.
- ✅ Vite слушает `127.0.0.1:5173` (IPv4) — страница открывается в браузере.
- ✅ Сессия 1: аутентификация (email/пароль, JWT-cookie) и модуль файлов заявок (загрузка/скачивание/удаление, согласия, лимиты, права, аудит).
- ⚠️ `bun --watch` из `apps/backend` следит только за файлами пакета; правки в `packages/shared` требуют ручного перезапуска dev-сервера.
- ✅ Миграция `20260907120417_init` содержит полный SQL схемы; для создания таблиц — `bun db:push` или `bun db:migrate`.

## Версионирование

- Каждое изменение поднимает версию пакетов-воркспейсов (`apps/backend`, `apps/frontend`, `packages/shared`) — синхронно по semver.
- Текущая версия указывается в сообщении git-коммита.
- Все изменения фиксируются в [`CHANGELOG.md`](CHANGELOG.md).
- Детальный план сессий и заметки — в [`PLANS.md`](PLANS.md), технический долг — в [`docs/technical-debt.md`](docs/technical-debt.md).
