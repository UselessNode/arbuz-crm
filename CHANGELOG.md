# Changelog

Все заметные изменения проекта фиксируются в этом файле.

**Правило версионирования:** каждое изменение (фикс, фича, рефакторинг) поднимает версию пакетов воркспейсов — `apps/backend`, `apps/frontend`, `packages/shared` (все синхронно, семантическое версионирование). Версия фиксируется в git-коммитах и вносится в этот файл.

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
