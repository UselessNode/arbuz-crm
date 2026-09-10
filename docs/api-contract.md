# API-контракт (Session 4 — админ-раздел)

Единый формат ответов об ошибках: `{ "error": { "code": "CODE", "message": "текст" } }`.
Аутентификация: httpOnly-cookie сессии (фронтенд ходит same-origin через Vite-прокси `/api`).
Все проверки прав — на бэкенде.

## Auth

| Метод | Путь | Доступ | Запрос | Ответ |
|---|---|---|---|---|
| POST | `/api/auth/login` | все | `{ email, password }` | `200 { user }` + cookie |
| POST | `/api/auth/register` | все (публично) | `{ email, password, surname?, name?, patronymic? }` | `201 { user }` + cookie (роль всегда `applicant`) |
| POST | `/api/auth/logout` | все | — | `{ ok: true }` |
| GET | `/api/auth/me` | авторизованные | — | `{ user }` |

`user`: `{ id, email, role, surname, name, patronymic }`

## Users (только admin)

| Метод | Путь | Запрос | Ответ |
|---|---|---|---|
| GET | `/api/users?role=&limit=&offset=` | — | `{ users: User[], total: number }` |
| POST | `/api/users` | `{ email, password, role, surname?, name?, patronymic? }` | `201 { user }` |
| GET | `/api/users/:id` | — | `{ user }` |
| PATCH | `/api/users/:id` | `{ email?, role?, surname?, name?, patronymic? }` | `{ user }` |
| POST | `/api/users/:id/reset-password` | `{ password }` | `{ ok: true }` |
| DELETE | `/api/users/:id` | — | `{ ok: true }` |
| GET | `/api/users/experts` | admin | — | `{ experts: { id, email, name, surname, patronymic }[] }` (без пагинации) |

- `limit` по умолчанию 20, максимум 100 (ограничение на бэкенде).
- `GET /api/users/experts` — полный список экспертов для селекта «назначить эксперта» (часть 3/3). ✅
- Сам себя нельзя понизить в роли и удалить (`SELF_ROLE_CHANGE_FORBIDDEN`, `SELF_DELETE_FORBIDDEN`).

## Applications

| Метод | Путь | Доступ | Запрос | Ответ |
|---|---|---|---|---|
| GET | `/api/applications?limit=&offset=` | роли по правилам | — | `{ applications: Summary[], total }` (`Summary.ownerName` заполняется) |
| POST | `/api/applications` | applicant, admin | `{ title, idea_description, importance_to_team, project_goal, project_tasks, implementation_experience?, results_description?, tender_id?, direction_id?, owner_id? (admin) }` | `201 { application }` |
| GET | `/api/applications/:id` | владелец / назначенный эксперт / admin | — | `{ application }` |
| PATCH | `/api/applications/:id` | owner (draft) / admin | частично те же поля (+ `status_id` — только admin) | `{ application }` |
| DELETE | `/api/applications/:id` | owner (draft) / admin | — | `{ ok: true }` |
| POST | `/api/applications/:id/submit` | owner / admin | — | `{ application }` |

**Состав заявки** (owner draft / admin):
- `GET/POST /api/applications/:id/team-members`, `PATCH/DELETE .../team-members/:memberId`
- `GET/POST /api/applications/:id/project-plans`, `PATCH/DELETE .../project-plans/:planId`
- `GET/POST /api/applications/:id/project-budget`, `PATCH/DELETE .../project-budget/:itemId`

**Согласия участника** (`consent_files`):
- `GET/POST /api/applications/:id/team-members/:memberId/consents`
- `GET /api/applications/:id/consents/:consentId/download`, `DELETE /api/applications/:id/consents/:consentId`
- В детали заявки у участника: `hasConsent` и `consentsCount`.

**Проверка перед отправкой:** `GET /api/applications/:id/validation` → `{ valid, issues[] }`
(≥ 1 участник, совершеннолетний координатор, согласие у каждого участника).
`POST /api/applications/:id/submit` возвращает 400 `APPLICATION_INVALID`, если состав не прошёл проверку.

`status` в детали: `{ id, name, isEditable, isDeletable }` — **список статусов берём только с бэкенда** (не хардкодим).
В списке (`GET /api/applications`) поле `status` — тоже объект `{ id, name } | null`; `ownerName` заполнен.

**Доступ к файлам заявки (1.9.0):** чтение/скачивание материалов и согласий доступно владельцу,
администратору и назначенному на заявку эксперту; загрузка/удаление — только владелец/админ.

## References (только admin)

| Метод | Путь | Запрос |
|---|---|---|
| GET/POST | `/api/tenders` | `{ name, description? }` |
| GET/PATCH/DELETE | `/api/tenders/:id` | `{ name?, description? }` |
| GET/POST | `/api/tenders/:id/criteria` | `{ name, description?, min_value?, max_value?, weight?, config? }` |
| PATCH/DELETE | `/api/tenders/:id/criteria/:criterionId` | те же поля частично |
| GET/POST | `/api/directions` (`?tenderId=`) | `{ name, description?, tender_id? }` |
| GET/PATCH/DELETE | `/api/directions/:id` | — |
| GET/POST | `/api/application-statuses` | `{ name, description?, is_editable?, is_deletable? }` |
| GET/PATCH/DELETE | `/api/application-statuses/:id` | — |

## Posts

| Метод | Путь | Доступ | Запрос |
|---|---|---|---|
| GET | `/api/posts?limit=&offset=` | **публично** | admin видит все, остальные — только опубликованные; ответ `{ posts, total }` |
| GET | `/api/posts/:id` | публично (по видимости) | черновик — только admin |
| POST | `/api/posts` | admin | `{ title, content, is_published? }` (content — Markdown; WYSIWYG во фронтенде) |
| PATCH | `/api/posts/:id` | admin | частично |
| DELETE | `/api/posts/:id` | admin | — |
| POST/GET | `/api/posts/:id/files` | admin / по видимости | multipart `file` |
| GET | `/api/posts/:id/files/:fileId/download` | по видимости | — |
| DELETE | `/api/posts/:id/files/:fileId` | admin | — |

**Готово в части 2/3:** ответы постов содержат санитизированный HTML (`contentHtml`, собирается из Markdown на сервере `marked` + `sanitize-html`). Произвольный HTML от клиента не принимается. С 1.10.0 редактирование — через WYSIWYG (`@mdxeditor/editor`), серверный `/preview` не используется.

## Reviews

| Метод | Путь | Доступ | Запрос |
|---|---|---|---|
| GET | `/api/reviews` | admin — все; expert — свои; applicant — по своим заявкам | — |
| POST | `/api/applications/:id/reviews` | admin (назначение) | `{ expert_id }` |
| PATCH | `/api/reviews/:id` | автор-эксперт / admin | `{ review_status?, review_text?, rating? }` |
| DELETE | `/api/reviews/:id` | admin (снятие) | — |

**Готово в части 3/3:** `GET /api/users/experts` — полный список экспертов (`{ id, email, name, surname, patronymic }`) для селекта «назначить эксперта», без пагинации. ✅

## Изменения бэкенда в рамках Session 4

- Часть 2/3: санитизация Markdown → HTML для постов. ✅
- Часть 3/3: эндпоинт списка экспертов для селекта; `ownerName` в списке заявок. ✅
- Часть 1/3: ограничение `limit` (default 20, max 100) для `/api/users` и `/api/applications`. ✅

## Изменения 1.9.0 (аудит и фиксы)

- Список заявок: `status` теперь `{ id, name } | null`.
- Создание/обновление заявки: валидация `tender_id`/`direction_id`/`status_id` (400 вместо 500).
- Файлы заявки: чтение доступно назначенному эксперту.

## Изменения 1.10.0 (MVP-1)

- `GET /api/posts`, `GET /api/posts/:id` — публичные (гость видит только опубликованные);
  пагинация `limit/offset` (default 20, max 100), ответ `{ posts, total }`.
- Деталь заявки: `hasConsent`/`consentsCount` у участников.
- `GET /api/applications/:id/validation`; `submit` возвращает 400 `APPLICATION_INVALID` при нарушениях.
