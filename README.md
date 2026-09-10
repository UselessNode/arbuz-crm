# 🍉 Arbuz CRM

Монорепозиторий CRM-системы для некоммерческой организации: цифровизация приёма и
рассмотрения грантовых заявок. Основной объект системы — **заявка** (`applications`):
направления и конкурсы, состав команды, план работ и бюджет, материалы и файлы
согласий, экспертные рецензии, статусы и публикации.

## Технологический стек

| Слой              | Технология                                                        |
| ----------------- | ----------------------------------------------------------------- |
| Пакетный менеджер | [Bun](https://bun.sh) `1.4.2` (workspaces + рантайм для бэкенда)  |
| Язык              | TypeScript                                                        |
| Backend           | Express (`apps/backend`), Bun как рантайм                         |
| Frontend          | React 18 + Vite (`apps/frontend`)                                 |
| Общий пакет       | `@arbuz/shared` — Prisma Client и общие типы/перечисления для воркспейсов |
| БД / ORM          | PostgreSQL + [Prisma](https://www.prisma.io) `7` + driver adapter `@prisma/adapter-pg` |
| Хранилище файлов  | Локальный диск (`./uploads`), без облачных/коммерческих сервисов  |

## Структура монорепозитория

```
arbuz-crm/
├── apps/
│   ├── backend/                      # @arbuz/backend — API-сервер (Express + Prisma)
│   │   ├── app.ts                    # Сборка Express-приложения (без запуска)
│   │   ├── index.ts                  # Точка входа: слушает порт, graceful shutdown
│   │   ├── seed.ts                   # Начальное наполнение (админ, статусы, демо)
│   │   ├── lib/                      # config, prisma, http, logger, multipart
│   │   ├── modules/                  # Доменные модули (*.routes.ts + *.service.ts)
│   │   │   ├── auth/                 # Вход/выход, сессия (JWT-cookie), регистрация
│   │   │   ├── users/                # Пользователи и роли (admin)
│   │   │   ├── applications/         # Заявки + состав (team-members/plans/budget)
│   │   │   ├── files/                # Хранилище, валидация, материалы и согласия
│   │   │   ├── tenders/              # Конкурсы и критерии оценки
│   │   │   ├── directions/           # Направления конкурсов
│   │   │   ├── statuses/             # Статусы заявок
│   │   │   ├── reviews/              # Экспертные рецензии
│   │   │   ├── posts/                # Публикации (Markdown) + вложения
│   │   │   └── pdf-export/           # Асинхронная PDF-выгрузка заявки
│   │   ├── scripts/                  # pdf-worker, cleanup-storage
│   │   └── uploads/                  # Файлы (не коммитится)
│   └── frontend/                     # @arbuz/frontend — веб-клиент (React + Vite)
│       ├── public/                   # favicon и статика
│       └── src/
│           ├── api/                  # Типизированный клиент и вызовы эндпоинтов
│           ├── auth/                 # Контекст аутентификации (восстановление сессии)
│           ├── components/ui/        # Дизайн-система (единый импорт из './ui')
│           ├── features/             # Разделы: auth, users, applications, reviews, posts, references
│           ├── layouts/              # AdminLayout (сайдбар + шапка)
│           ├── pages/                # AccountPage, ForbiddenPage, NotFoundPage, DesignSystemPage
│           ├── router/               # AppRouter, ProtectedRoute, HomeRedirect
│           ├── styles/               # Дизайн-токены (tokens.css)
│           └── assets/               # Иконки (SVG), изображения
├── packages/
│   └── shared/                       # @arbuz/shared
│       ├── prisma/
│       │   ├── schema.prisma         # SSOT схемы БД
│       │   └── migrations/           # Миграции Prisma
│       ├── src/generated/prisma/     # Сгенерированный Prisma Client (не коммитится)
│       └── index.ts                  # Реэкспорт клиента и перечислений
├── docs/
│   ├── api-contract.md               # Контракт API текущей сессии
│   ├── api-testing-postman.md        # Гайд по проверке API через Postman
│   └── technical-debt.md             # Осознанные «хвосты» и отложенные решения
├── postman/                          # Коллекция запросов
├── prisma.config.ts                  # Конфигурация Prisma 7 (schema/migrations)
├── AGENTS.md                         # Рабочий контекст для агента
├── PLANS.md                          # Дорожная карта и заметки по сессиям
├── CHANGELOG.md                      # История версий
└── package.json                      # Скрипты корня монорепозитория
```

Воркспейсы: `apps/*` и `packages/*`. Внутренняя зависимость — `@arbuz/shared`
(`workspace:*`), в `tsconfig` подключается через paths.

## Требования

- [Bun](https://bun.sh) `1.4.2` — установить и добавить в `PATH`.
- PostgreSQL и `DATABASE_URL` в `.env` в корне репозитория (см. `.env.example`).

## Установка и запуск

```sh
# 0. Клонировать репозиторий
git clone <...>
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
bun seed                    # админ + статусы
SEED_DEMO=true bun seed     # + демо-заявитель, демо-заявка, участник команды

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
| `bun seed`             | Начальное наполнение: администратор + статусы (+демо при `SEED_DEMO=true`) |
| `bun storage:cleanup`  | Очистка удалённых/осиротевших файлов (для cron)        |

## База данных

- Схема: `packages/shared/prisma/schema.prisma` (PostgreSQL) — **единственный источник истины**.
- Конфигурация Prisma 7 — в `prisma.config.ts` в корне (пути к схеме и миграциям, URL из `process.env.DATABASE_URL`).
- Генератор выводит клиент в `packages/shared/src/generated/prisma`; оттуда его реэкспортирует `packages/shared/index.ts` под именем `@arbuz/shared`.
- Сгенерированный клиент не хранится в git (см. `.gitignore`): после клонирования обязателен `bun db:generate`.
- Основные домены схемы:
  - **Пользователи и роли** — `users` (роли `admin`, `expert`, `applicant`).
  - **Конкурсы и направления** — `tenders`, `directions`, критерии оценки `evaluation_criteria`.
  - **Заявки** — `applications`, статусы `application_statuses`, рецензии `application_reviews`.
  - **Содержимое заявки** — `project_plans`, `project_budget`, `team_members` + `consent_files`, материалы `additional_materials`.
  - **Прочее** — `files`/`file_categories`, `posts`/`posts_files`, `pdf_export_jobs`, журнал `change_logs`.
- Конвенции: `snake_case`, мягкое удаление через `deleted_at`, частичные индексы `(deleted_at IS NULL)`.

## Роли и модель доступа

| Роль      | Возможности                                                                                   |
| --------- | --------------------------------------------------------------------------------------------- |
| `admin`   | Полный доступ: пользователи и роли, заявки, справочники, посты, назначение экспертов, модерация |
| `expert`  | Только назначенные ему заявки и собственные рецензии (оценивание)                             |
| `applicant` | Свои заявки (создание/отправка), опубликованные посты, свой вердикт/статус                  |

Все проверки доступа выполняются **на бэкенде** (`requireAuth`/`requireRole` и проверки
владения в сервисах); фронтенд лишь скрывает недоступные действия. Роли и статусы
сравниваются через перечисления из `@arbuz/shared` (`RoleType`, `ReviewStatus`,
`PdfExportStatus`) — без строковых литералов.

## API

Контракт по сессиям зафиксирован в [`docs/api-contract.md`](docs/api-contract.md).

### Аутентификация

- `POST /api/auth/login` — вход по email/паролю, выдаёт JWT в httpOnly-cookie `arbuz_session`.
- `POST /api/auth/register` — публичная саморегистрация (роль жёстко `applicant`).
- `POST /api/auth/logout`, `GET /api/auth/me` — выход и текущий пользователь.
- Пароли: argon2id (`Bun.password`). В будущем возможны внешние провайдеры (Госуслуги/ВК) без изменения схемы.

### Пользователи (только admin)

`GET/POST /api/users`, `GET/PATCH/DELETE /api/users/:id`,
`POST /api/users/:id/reset-password`, `GET /api/users/experts`.

### Заявки (по ролям)

`GET/POST /api/applications`, `GET/PATCH/DELETE /api/applications/:id`,
`POST /api/applications/:id/submit`.
Состав: `GET/POST/PATCH/DELETE /api/applications/:id/team-members|project-plans|project-budget`.

### Справочники (только admin)

Тендеры `/api/tenders`, критерии `/api/tenders/:id/criteria`, направления `/api/directions`,
статусы `/api/application-statuses`.

### Рецензии

Назначение эксперта `POST /api/applications/:id/reviews` (admin), список
`GET /api/reviews` (по ролям), оценка `PATCH /api/reviews/:id`, снятие `DELETE /api/reviews/:id`.
Итоговый балл (`total_score`) считается на сервере по критериям конкурса.

### Посты (лента новостей)

`GET/POST/PATCH/DELETE /api/posts[/:id]` (создание/правка/публикация — admin; чтение
опубликованного — все). Содержимое — Markdown; HTML рендерится и санитизируется на
сервере (`contentHtml`, `POST /api/posts/preview`). Вложения —
`POST/GET/DELETE /api/posts/:id/files[/:fileId][/download]`.

### PDF-экспорт заявки

Асинхронная генерация, статус хранится в `pdf_export_jobs`:
`POST /api/applications/:id/pdf-export`, `GET /api/pdf-export-jobs/:jobId`, `GET .../download`.

### Файлы заявок

- Хранение: диск (`UPLOAD_DIR`, по умолчанию `./uploads` относительно корня пакета `apps/backend`, не зависит от рабочего каталога запуска).
  Папка заявки — `<owner_id>-<application_id>-<время>`; согласия — в подпапке `consents/`.
- В БД хранятся относительные пути; разрешены PDF, DOCX, JPEG, PNG, MP4 (проверка содержимого + расширения). Имена на диске — UUID.
- Лимиты: 10 МБ на файл, 25 МБ на все файлы заявки.
- Доступ: владелец заявки или администратор; файлы отдаются только через API.
- Материалы заявки (`additional_materials`): `POST/GET /api/applications/:id/files`, `GET .../files/:fileId/download`, `DELETE .../files/:fileId`.
- Согласия участников (`consent_files`): `GET/POST /api/applications/:id/team-members/:memberId/consents`, `GET .../consents/:consentId/download`, `DELETE .../consents/:consentId`.
- Аудит действий (вход, загрузка/скачивание/удаление) пишется в `logs/audit.log`.
- Очистка: `bun storage:cleanup` (например, в cron).

## Frontend

- **Дизайн-система** — `src/components/ui` с единым barrel-импортом:
  `Icon`, `Button`, `Badge`/`StatusBadge` (+ `ROLE_OPTIONS`, `VERDICT_OPTIONS`, `APPLICATION_STATUS_OPTIONS`),
  `Container`/`Accordion`/`Carousel`, `DragDrop`, `Input`/`NumberInput`/`Slider`/`DatePicker`/`Select`/`Textarea`/`Checkbox`,
  `Table`, `StateMessage`/`Modal`/`ConfirmDialog`, `Pagination`.
- Иконки — кастомные SVG из `src/assets/icons/*.svg`, подхватываются через `import.meta.glob`; цвет наследуется через `currentColor`.
- Демонстрация всех компонентов — страница `/admin/design-system`.
- **Разделы админки** (`/admin`): Пользователи, Заявки, Рецензии, Посты, Тендеры, Направления, Статусы заявок.
- **Публичные страницы**: домашняя `/` (лента публикаций + контакты), `/about`, `/privacy`, вход `/login`, регистрация `/register` (с обязательным соглашением). Шапка авторизованной зоны окрашена по роли (админ — серый, эксперт — зелёный, заявитель — синий).

## Тестирование (запланировано)

- Коллекция Postman: `postman/arbuz-crm.postman_collection.json`, инструкция — [`docs/api-testing-postman.md`](docs/api-testing-postman.md).
- Автотесты: unit (валидация файлов, квоты, папки) и интеграционные через `bun test`
  (поднять сервер → login → upload/download/delete → согласия).
- Прогон коллекции через Postman Runner / Newman (возможно в CI).

## Заметки для деплоя

- Каталог `uploads/` держать вне статики веб-сервера (файлы раздаёт только API): nginx не должен обслуживать его.
- Права на сервере: файлы `640`, каталоги `750`; запрет исполнения в `uploads/`.
- `JWT_SECRET` — длинная случайная строка; в production без него сервер не стартует.
- Резервное копирование: БД + `uploads/` (+ `logs/` при необходимости).

## Известные особенности

- `bun --watch` из `apps/backend` следит только за файлами пакета; правки в `packages/shared`
  требуют ручного перезапуска dev-сервера.
- `.env` читается только через `bun run`-скрипты (dotenv-cli); при прямом запуске из
  `apps/backend` переменные не подхватываются.
- Каталог `uploads/` создаётся автоматически при первой загрузке.

## Версионирование

- Семантика версий: **X.0.0** — мажорный апдейт, **1.X.0** — обычный апдейт (фича),
  **1.4.X** — минорный апдейт (патч/фикс).
- Значимые изменения поднимают версию всех воркспейсов синхронно (`apps/backend`,
  `apps/frontend`, `packages/shared`); версия указывается в сообщении git-коммита.
- Все изменения фиксируются в [`CHANGELOG.md`](CHANGELOG.md).
- Дорожная карта и заметки — в [`PLANS.md`](PLANS.md); технический долг — в
  [`docs/technical-debt.md`](docs/technical-debt.md); рабочий контекст агента — в [`AGENTS.md`](AGENTS.md).
