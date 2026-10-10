# API-контракт (Session 4 — админ-раздел)

Единый формат ответов об ошибках: `{ "error": { "code": "CODE", "message": "текст" } }`.
Аутентификация: httpOnly-cookie сессии (фронтенд ходит same-origin через Vite-прокси `/api`).
Все проверки прав — на бэкенде.

## Auth

| Метод | Путь | Доступ | Запрос | Ответ |
|---|---|---|---|---|
| POST | `/api/auth/login` | все | `{ email, password }` | `200 { user }` + cookie |
| POST | `/api/auth/register` | все (публично) | `{ email, password, surname?, name?, patronymic?, region_id?, accept_terms, accept_personal_data_consent }` | `201 { user }` + cookie (роль всегда `applicant`) |
| POST | `/api/auth/activate` | неактивированный | `{ surname?, name?, patronymic?, region_id?, password?, accept_terms, accept_personal_data_consent }` | `{ user }` |
| POST | `/api/auth/logout` | все | — | `{ ok: true }` |
| GET | `/api/auth/me` | авторизованные | — | `{ user }` |

`user`: `{ id, email, role, surname, name, patronymic, regionId, regionName, activatedAt }`

## Users (только admin)

| Метод | Путь | Запрос | Ответ |
|---|---|---|---|
| GET | `/api/users?role=&limit=&offset=` | — | `{ users: User[], total: number }` |
| POST | `/api/users` | `{ email, password, role, surname?, name?, patronymic?, region_id? }` | `201 { user }` |
| GET | `/api/users/:id` | — | `{ user }` |
| PATCH | `/api/users/:id` | `{ email?, role?, surname?, name?, patronymic?, region_id? }` | `{ user }` |
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

## References (чтение — авторизованным, изменения — admin)

GET-эндпоинты (конкурсы, направления, статусы, критерии) доступны любому авторизованному
пользователю (нужны для формы заявки и оценки эксперта), POST/PATCH/DELETE — только администратору.

| Метод | Путь | Запрос |
|---|---|---|
| GET/POST | `/api/tenders` | `{ name, description?, experts_count? }` |
| GET/PATCH/DELETE | `/api/tenders/:id` | `{ name?, description?, experts_count? }` |
| GET | `/api/tenders/:id/impact` | admin — `{ applications, reviews }` (последствия сброса) |
| POST | `/api/tenders/:id/reset-applications` | admin — заявки → «Черновик», экспертизы снимаются |
| GET/POST | `/api/tenders/:id/criteria` | `{ name, description?, min_value?, max_value?, weight?, config? }` |
| PATCH/DELETE | `/api/tenders/:id/criteria/:criterionId` | те же поля частично |
| GET/POST | `/api/directions` (`?tenderId=`) | `{ name, description?, tender_id? }` |
| GET/PATCH/DELETE | `/api/directions/:id` | — |
| GET/POST | `/api/application-statuses` | `{ name, description?, is_editable?, is_deletable? }` |
| GET/PATCH/DELETE | `/api/application-statuses/:id` | — |
| GET/POST | `/api/review-statuses` | вердикты экспертиз: `{ name, description?, tone?, is_default? }` |
| PATCH/DELETE | `/api/review-statuses/:id` | вердикт по умолчанию и используемый в экспертизах удалить нельзя |
| GET/POST | `/api/regions` | `{ name, is_default?, sort_order? }` — справочник регионов |
| GET/PATCH/DELETE | `/api/regions/:id` | — |

## Site settings (тексты сайта)

| Метод | Путь | Доступ | Запрос |
|---|---|---|---|
| GET | `/api/site-settings/:key` | **публично** | — → `{ setting }` (нужно главной, подвалу и странице «О проекте») |
| GET | `/api/site-settings` | admin | — → `{ settings }` (все ключи) |
| PUT | `/api/site-settings/:key` | admin | `{ text }` (Markdown; наружу отдаётся безопасный HTML) |

Ключи (`SiteSettingKey`): `about` — страница «О проекте»; `home_contacts` — блок контактов на главной;
`footer` — содержимое подвала (реквизиты). Без версионирования — хранится только текущее значение.

## Posts

| Метод | Путь | Доступ | Запрос |
|---|---|---|---|
| GET | `/api/posts/feed?limit=&offset=&q=` | **публично** | публичная лента: только `published` (черновики, отложенные и архив не отдаются никому); ответ `{ posts, total }` |
| GET | `/api/posts?limit=&offset=&q=&status=` | admin | список раздела «Публикации»: все статусы, `status` = `draft\|scheduled\|published\|archived` |
| GET | `/api/posts/:id` | публично (по видимости) | не-админ видит только опубликованный пост |
| POST | `/api/posts` | admin | `{ title, content, is_published?, hide_author?, scheduled_at?, archived? }` (content — Markdown; WYSIWYG во фронтенде) |
| PATCH | `/api/posts/:id` | admin | полный набор полей (документ заменяется целиком) |
| DELETE | `/api/posts/:id` | admin | — |
| POST/GET | `/api/posts/:id/files` | admin / по видимости | multipart `file` |
| GET | `/api/posts/:id/files/:fileId/download` | публично для опубликованных постов, иначе по видимости | — |
| DELETE | `/api/posts/:id/files/:fileId` | admin | — |

Статус поста (`PostStatus` из `@arbuz/shared`) вычисляется из полей `posts`:
`archived` (задан `archived_at`) → `scheduled` (`scheduled_at` в будущем) → `published`
(`is_published = true`) → `draft`. Отложенная публикация появляется в ленте сама по наступлении
`scheduled_at` — без фонового воркера. `edited_at` проставляется при правке заголовка/текста.

**Готово в части 2/3:** ответы постов содержат санитизированный HTML (`contentHtml`, собирается из Markdown на сервере `marked` + `sanitize-html`). Произвольный HTML от клиента не принимается. С 1.10.0 редактирование — через WYSIWYG (`@mdxeditor/editor`), серверный `/preview` не используется.

## Reviews

| Метод | Путь | Доступ | Запрос |
|---|---|---|---|
| GET | `/api/reviews` | admin — все; expert — свои; applicant — по своим заявкам | — |
| POST | `/api/applications/:id/reviews` | admin (назначение, не больше `tenders.experts_count`) | `{ expert_id }` |
| PATCH | `/api/reviews/:id` | автор-эксперт / admin | `{ status_id?, review_text?, rating? }` |
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

## Изменения 1.11.0 (MVP-1.1)

- Публикации редактируются в WYSIWYG (`@mdxeditor/editor`); серверный `POST /api/posts/preview` удалён.

## Изменения 1.18.0 (жизненный цикл публикаций)

- **Публичная лента вынесена в `GET /api/posts/feed`** — отдаёт только опубликованные посты
  независимо от роли: черновики, отложенные и архив не видны на главной никому.
- `GET /api/posts` — список раздела «Публикации» (admin), фильтр `?status=`.
- `PATCH /api/posts/:id` принимает `scheduled_at` (ISO) и `archived` (boolean);
  отложка подразумевает `is_published = true`; `edited_at` — только при правке содержимого.
- Ответ поста: `status`, `scheduledAt`, `archivedAt`, `editedAt` (вместо `is_published`).
- Добавлены смоук-тесты backend: `bun test:smoke` (см. `apps/backend/tests/README.md`).

## Изменения 1.14.0 (MVP-3.1 + MVP-4)

- `tenders.experts_count` (default 2); `GET /api/tenders/:id/impact`;
  `POST /api/tenders/:id/reset-applications`; `GET /api/tenders/:id/criteria-history`.
- Критерии: валидация `min_value <= max_value`, `weight > 0`; изменения пишутся в историю.
- PDF-экспорт доступен назначенному эксперту; в PDF добавлен список материалов.
- Деталь заявки: `tender.expertsCount`.

## Изменения 1.13.0 (MVP-3, часть A)

- Критерии конкурса (`GET /api/tenders/:id/criteria`) — чтение доступно авторизованным (эксперт/админ).
- `PATCH /api/reviews/:id` — эксперт сохраняет оценку (`rating`, `review_status`, `review_text`);
  `total_score` считает сервер.
- Редактирование заявки: владелец (в т.ч. назначенный админом) может редактировать свою заявку
  независимо от отправки.

## Изменения 1.12.0 (MVP-2)

- Справочники (конкурсы/направления/статусы): **чтение** доступно любому авторизованному (для формы заявки),
  изменения — только admin.
- Файлы заявки: изменение материалов/согласий требует редактируемого статуса (владелец не может менять
  заявку после отправки); чтение — владелец/admin/назначенный эксперт.
- Создание заявки администратором: `owner_id` (владелец) выбирается в UI.
