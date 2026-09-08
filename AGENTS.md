# AGENTS.md — рабочий контекст для агента

Короткая сводка проекта и договорённости. Обновлять по мере появления новых фактов/решений.

## Проект

- Монорепозиторий на **Bun workspaces** (`apps/*`, `packages/*`). Windows.
- Пакеты: `@arbuz/backend` (Express), `@arbuz/frontend` (React 18 + Vite), `@arbuz/shared` (Prisma-клиент/типы).
- БД: PostgreSQL + Prisma 7, driver adapter `@prisma/adapter-pg`.

## Ключевые команды (из корня)

- `bun dev` — frontend + backend вместе; `bun dev:backend` (порт 3000), `bun dev:frontend` (5173).
- `bun typecheck` — shared → backend → frontend. `bun run build` — typecheck + сборка (именно `run`, т.к. `bun build` — встроенный bundler).
- `bun db:generate` / `bun db:push` / `bun db:update`.
- Bun лежит в `C:\Users\Reloya\.bun\bin` (в PATH).

## Договорённости / версионирование

- **Каждое изменение** поднимает версию пакетов синхронно (semver) в `apps/backend`, `apps/frontend`, `packages/shared` (+ синхронизировать `bun.lock` через `bun install`).
- Версия указывается в сообщении git-коммита; запись добавляется в `CHANGELOG.md`.
- Коммиты по-русски не обязательны, но описания — фактические.

## Известные особенности и подводные камни

- Prisma Client генерируется в `packages/shared/src/generated/prisma` и **не коммитится** — после клонирования обязателен `bun db:generate`.
- Backend загружает `.env` из корня только через root-скрипт `dev:backend` (`dotenv-cli`); при прямом запуске из `apps/backend` env не подхватывается. Относительный `--env-file` в bun 1.4.2 на Windows не резолвится — не использовать.
- Vite намеренно слушает `127.0.0.1` (IPv4), а не только `[::1]` — иначе `localhost` не открывается в браузере. Открывать http://127.0.0.1:5173/.
- `bun --watch` из `apps/backend` не следит за `packages/shared` (файлы вне каталога) — перезапускать вручную при правках shared.
- В sandbox-терминале агента loopback-соединения к локальным dev-серверам блокируются: проверять доступность лучше через `netstat`, а не fetch/curl.
- `git config user` локально настроен (Rёloя / razum20@bk.ru).

## Рабочие заметки / план (для себя)

- (место для текущих задач и наблюдений агента)
