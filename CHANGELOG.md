# Changelog

Все заметные изменения проекта фиксируются в этом файле.

**Правило версионирования:** каждое изменение (фикс, фича, рефакторинг) поднимает версию пакетов воркспейсов — `apps/backend`, `apps/frontend`, `packages/shared` (все синхронно, семантическое версионирование). Версия фиксируется в git-коммитах и вносится в этот файл.

## [1.4.0] - 2026-09-09

Фаза C закрытия пробелов бэкенда — справочники (админ).

### Added

- Тендеры: `GET/POST /api/tenders`, `GET/PATCH/DELETE /api/tenders/:id`.
- Критерии тендера: `GET/POST /api/tenders/:id/criteria`, `PATCH/DELETE /api/tenders/:id/criteria/:criterionId`.
- Направления: `GET/POST /api/directions`, `GET/PATCH/DELETE /api/directions/:id` (фильтр `?tenderId=`).
- Статусы заявок: `GET/POST /api/application-statuses`, `GET/PATCH/DELETE /api/application-statuses/:id`.

## [1.3.0] - 2026-09-09

Фаза B закрытия пробелов бэкенда — заявки и их состав.

### Added

- Модуль `applications`: `GET/POST /api/applications`, `GET/PATCH/DELETE /api/applications/:id`, `POST /api/applications/:id/submit`.
- Ролевой доступ: администратор — все заявки; заявитель — свои (создание/редактирование до отправки); эксперт — только назначенные.
- Вложенный состав заявки: `team-members`, `project-plans`, `project-budget` (GET/POST/PATCH/DELETE).
- Отправка заявки переводит её в статус «На проверке» и фиксирует `submitted_at`.
- Полная детализация заявки: статус, тендер/направление, владелец, команда, план, бюджет, материалы, рецензии.

## [1.2.0] - 2026-09-09

Фаза A закрытия пробелов бэкенда — управление пользователями и общий role-guard.

### Added

- `requireRole(...roles)` в `auth.middleware` — единая авторизация по ролям.
- Модуль `users` (только администратор): `GET/POST /api/users`, `GET/PATCH/DELETE /api/users/:id`, `POST /api/users/:id/reset-password` (создание, смена роли, сброс пароля, блокировка).
- Защита от самопонижения/самоудаления администратора; проверка уникальности email; минимальная длина пароля 8.

### Fixed

- `requireAuth` больше не бросает ошибку в промисе async-мидлвара (Express 4 её не ловит) — ошибки передаются в `next(err)`.

## [1.1.1] - 2026-09-09

Промежуточная сессия — рефакторинг и наведение порядка в документации.

### Changed

- Убраны строковые литералы ролей/статусов — используется сгенерированные enum'ы из `@arbuz/shared` (`RoleType`, `PdfExportStatus`) и константы типов файлов (`FileTypes`).
- Аргумент воркера `--job` вынесен в константу `WORKER_JOB_ARG`.
- Документация разделена: краткие правила — `AGENTS.md`, детальный план/заметки — `PLANS.md`, техдолг — `docs/technical-debt.md`.

## [1.1.0] - 2026-09-08

Сессия 2 — архитектура модулей: pdf-export и посты.

### Added

- **Схема БД** (миграция `20260908154317_session2_modules`): `pdf_export_jobs`
  (статусы `pending|processing|done|error`) и join-таблица `posts_files`.
- **Модуль pdf-export**: асинхронная генерация PDF заявки отдельным воркером
  (`scripts/pdf-worker.ts`), статусы заданий, скачивание готового PDF.
  Рендер — pdfmake со встроенными шрифтами Roboto (кириллица). 9 секций
  текста + таблица бюджета (шаблон — см. `docs/technical-debt.md`).
  Эндпоинты: `POST /api/applications/:id/pdf-export`,
  `GET /api/pdf-export-jobs/:jobId`, `GET /api/pdf-export-jobs/:jobId/download`.
- **Модуль posts**: CRUD для администратора (Markdown в `posts.content`),
  остальные читают только опубликованное; вложения к постам через `posts_files`
  и модуль files. Эндпоинты: `GET/POST/PATCH/DELETE /api/posts[/:id]`,
  `POST/GET/DELETE /api/posts/:id/files[/:fileId][/download]`.
- **Архитектура**: разделение `app.ts` (сборка Express) и `index.ts` (запуск);
  чтение multipart вынесено в `lib/multipart.ts`.

### Fixed

- Тип файла в БД (`file_type`, VARCHAR(50)) теперь хранится коротким токеном
  (`pdf/docx/jpg/png/mp4`) — полный MIME у DOCX длиннее 50 символов и не влезал бы
  в колонку. MIME вычисляется при отдаче файла.

## [1.0.4] - 2026-09-08

### Added

- Коллекция Postman для проверки API (`postman/arbuz-crm.postman_collection.json`) и пошаговый гайд (`docs/api-testing-postman.md`).
- В план добавлен блок тестирования: автотесты `bun test`, прогон Postman Runner/Newman (место выделено в графике).

## [1.0.3] - 2026-09-08

Сессия 1 — базовая работа с файлами.

### Added

- **Аутентификация**: вход по email + паролю (argon2id), JWT в httpOnly-cookie (`arbuz_session`); `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`. Архитектура допускает добавление внешних провайдеров (Госуслуги/ВК) в будущем.
- **Хранение файлов**: локальный диск `./uploads/` (самодостаточное хранилище без облаков); на каждую заявку каталог `<owner_id>-<application_id>-<время>`, согласия — в подкаталоге `consents/`; в БД хранятся относительные пути `uploads/...`.
- **Файлы заявки**: `POST/GET /api/applications/:id/files`, скачивание и удаление материалов (`additional_materials`); согласия участников команды (`consent_files`) со своим набором маршрутов.
- **Проверки**: разрешены PDF, DOCX, JPEG, PNG, MP4 — проверка по содержимому (магические байты) и расширению; переименование в UUID; лимиты 10 МБ на файл и 25 МБ на заявку.
- **Права**: доступ к файлам заявки — у владельца и администратора; остальные маршруты требуют аутентификации.
- **Скрипты**: `bun seed` (администратор и опциональные демо-данные), `bun storage:cleanup` (очистка удалённых и осиротевших файлов — для cron).
- **Аудит**: журнал `logs/audit.log` (вход, загрузка/скачивание/удаление файлов).

## [1.0.2] - 2026-09-08

### Added

- `AGENTS.md` в корне — рабочий контекст для агента (сводка, команды, договорённости, подводные камни, заметки).

## [1.0.1] - 2026-09-08

### Fixed

- Vite dev-сервер слушал только IPv6 (`[::1]`), поэтому браузер, обращающийся к `localhost` по IPv4, получал «отказ в подключении». Хост зафиксирован на `127.0.0.1`, включён `strictPort`; прокси на backend переведён на `127.0.0.1:3000`.

## [1.0.0] - 2026-09-08

Первая рабочая версия монорепозитория.

### Added

- Монорепозиторий на Bun workspaces: `apps/backend`, `apps/frontend`, `packages/shared`.
- Backend: Express-сервер с маршрутами `GET /` и `GET /health` (проверка подключения к БД), graceful shutdown.
- Подключение к PostgreSQL через Prisma 7 + driver adapter `@prisma/adapter-pg`.
- Prisma Client генерируется в `packages/shared/src/generated/prisma` и раздаётся воркспейсам через `@arbuz/shared`.
- Frontend: React 18 + Vite, прокси запросов `/api` и `/health` на backend.
- Скрипты корня: `dev`, `dev:backend`, `dev:frontend`, `typecheck`, `run build`, `db:*`.
- Загрузка `.env` для backend через `dotenv-cli`.
- `README.md`, `.gitignore`, `.env.example`.
