# AGENTS.md — рабочий контекст для агента

Короткая сводка проекта и договорённости. Детальный план — в [`PLANS.md`](PLANS.md),
технический долг — в [`docs/technical-debt.md`](docs/technical-debt.md).

## Проект

- Монорепозиторий на **Bun workspaces** (`apps/*`, `packages/*`). Windows.
- Пакеты: `@arbuz/backend` (Express), `@arbuz/frontend` (React 18 + Vite), `@arbuz/shared` (Prisma-клиент/типы).
- БД: PostgreSQL + Prisma 7, driver adapter `@prisma/adapter-pg`.
- Заявка (`applications`) — главный объект CRM (цифровизация приёма грантовых заявок для НКО).

## Ключевые команды (из корня)

- `bun dev` — frontend + backend вместе; `bun dev:backend` (порт 3000), `bun dev:frontend` (5173).
- `bun typecheck` — shared → backend → frontend. `bun run build` — typecheck + сборка (именно `run`, т.к. `bun build` — встроенный bundler).
- `bun db:generate` / `bun db:push` / `bun db:update` / `bun db:migrate`.
- `bun seed` / `bun storage:cleanup`.
- Bun лежит в `C:\Users\Reloya\.bun\bin` (в PATH).

## Договорённости / версионирование

- Семантика: **X.0.0** — мажорный апдейт, **1.X.0** — обычный апдейт (фича), **1.4.X** — минорный апдейт (патч/фикс).
- **Значимые изменения** (фича, фикс, новый модуль, схема БД) поднимают версию пакетов синхронно (semver) в `apps/backend`, `apps/frontend`, `packages/shared` (+ синхронизировать `bun.lock` через `bun install`).
- Версия указывается в сообщении git-коммита; запись добавляется в `CHANGELOG.md`.
- **Многочастные сессии**: на всю сессию — одна версия (по масштабу), части помечаются в коммите и changelog: `(Session N — часть X/Y)`. Версия не дробится на патчи внутри одной сессии.
- **Мелкие правки** (заметки, комментарии, косметика) отдельно НЕ версионируются и НЕ коммитятся — накапливаются и попадают в ближайший значимый коммит.
- Коммиты по-русски не обязательны, но описания — фактические.

## Правила кода

- **НЕ использовать строковые сравнения** вместо сгенерированных enum-ов, например `user.role !== 'admin'`. Роли/статусы импортировать из `@arbuz/shared` (`RoleType`, `ReviewStatus`, `PdfExportStatus`) и сравнивать через константы/типы.
- Каждый модуль — папка `modules/<имя>/` с `*.routes.ts` (только HTTP) и `*.service.ts` (бизнес-логика). Общее — в `lib/`.
- Схема БД (`packages/shared/prisma/schema.prisma`) — SSOT; менять только при осознанной необходимости (логическая ошибка/значимое упрощение).
- Frontend: всё переиспользуемое — только из `components/ui` (централизация/унификация); статусы/роли — без магических строк.

## Известные особенности и подводные камни

- Prisma Client генерируется в `packages/shared/src/generated/prisma` и **не коммитится** — после клонирования обязателен `bun db:generate`.
- Backend загружает `.env` из корня только через root-скрипт `dev:backend` (`dotenv-cli`); при прямом запуске из `apps/backend` env не подхватывается. Относительный `--env-file` в bun 1.4.2 на Windows не резолвится — не использовать.
- `dotenv` вызывается только внутри `bun run`-скриптов (bun сам добавляет `node_modules/.bin` в PATH); напрямую из shell он недоступен (`command not found`). Если нужно вручную — полный путь `node_modules/.bin/dotenv`.
- Vite намеренно слушает `127.0.0.1` (IPv4), а не только `[::1]` — иначе `localhost` не открывается в браузере. Открывать http://127.0.0.1:5173/.
- `bun --watch` из `apps/backend` не следит за `packages/shared` (файлы вне каталога) — перезапускать вручную при правках shared.
- В sandbox-терминале агента loopback-соединения к локальным dev-серверам блокируются: проверять доступность лучше через `netstat`, а не fetch/curl.
- `git config user` локально настроен (Rёloя / razum20@bk.ru).
