# Смоук-тесты backend

Небольшие проверки «сквозных» сценариев backend, которые запускаются вручную и не требуют
HTTP-клиента: они вызывают сервисы напрямую и работают с **dev-базой** (запускать после
`bun seed`). Провал возвращает код 1.

## Запуск

```bash
bun test:smoke          # из корня: dotenv подхватывает .env, затем tests/run.ts
bun --cwd apps/backend test:smoke   # если .env уже загружен в окружение
```

Отдельный файл можно запустить напрямую:

```bash
dotenv -e .env -- bun --cwd apps/backend tests/smoke/posts.smoke.ts
```

## Состав

| Файл | Что проверяет |
|---|---|
| `smoke/posts.smoke.ts` | Жизненный цикл публикаций, фильтры раздела, гарантии публичной ленты |
| `smoke/reviews.smoke.ts` | Лимит экспертов из настроек конкурса, приватность экспертиз |
| `smoke/reviews-summary.smoke.ts` | Сводка по экспертизам: отбор по критерию, итоги, доступ только админу |
| `smoke/review-grouping.smoke.ts` | Режимы таблицы экспертиз: группировка, диапазоны оценки/даты, критерий отчёта (чистая логика из `apps/frontend/src/lib/review-grouping.ts`) |
| `smoke/files.smoke.ts` | Санитизация имени файла, определение типа по содержимому и расширению |
| `smoke/budget.smoke.ts` | Правила бюджета: расчётная стоимость vs финансирование (чистая логика из `apps/frontend/src/lib/budget.ts`) |
| `smoke/markdown.smoke.ts` | Рендер Markdown публикаций: подсветка `==…==`, выноски, чек-листы, строчный HTML, сборка галереи из подряд идущих картинок и защита от опасного ввода |
| `smoke/post-content.smoke.ts` | Разбор HTML публикации на блоки (обычный HTML + галереи для карусели) |
| `smoke/accordion.smoke.ts` | Состояние раскрытия аккордеона (`defaultOpen` идемпотентен — иначе StrictMode сворачивает секции) |
| `smoke/carousel.smoke.ts` | Переключение слайдов карусели (закольцовывание, пустой набор) |
| `smoke/range-slider.smoke.ts` | Ползунок с двумя границами: прижатие к границам и шагу, границы не перескакивают друг через друга |
| `smoke/date-range.smoke.ts` | Выбор периода дат и сетка календаря (сдвиг до понедельника, навигация по месяцам, десятилетие) |
| `smoke/date-mask.smoke.ts` | Маска ввода даты `дд.мм.гггг`: подстановка точек, отсев несуществующих дат, перевод в ISO и обратно |
| `smoke/frontend-shared-imports.smoke.ts` | Инвариант: во фронтенде `@arbuz/shared` — только `import type` (иначе в бандл попадает CJS Prisma-клиент и страница белая) |

## Правила

- Сценарий обязан убирать за собой созданные записи (в `finally`), чтобы повторный запуск
  не накапливал мусор в dev-базе.
- Никаких «магических строк» для ролей и справочников: роли — из `RoleType`, статусы заявок —
  по именам из `lib/app-status.ts`.
- Здесь только backend-логика. Проверка HTTP-слоя (Postman/коллекция) — отдельный трек,
  см. `docs/api-testing-postman.md`.
- `smoke/frontend-shared-imports.smoke.ts` — исключение: он не работает с БД, а проверяет
  инвариант исходников фронтенда (рантайм-импорт `@arbuz/shared` роняет приложение в dev).
- `smoke/markdown.smoke.ts`, `smoke/budget.smoke.ts`, `smoke/accordion.smoke.ts`,
  `smoke/carousel.smoke.ts`, `smoke/range-slider.smoke.ts`, `smoke/date-range.smoke.ts`,
  `smoke/date-mask.smoke.ts`, `smoke/review-grouping.smoke.ts` и `smoke/post-content.smoke.ts`
  тоже без БД: они проверяют чистую логику (рендер Markdown, правило бюджета, состояние
  аккордеона, переходы карусели и диапазонов, маску даты, группировку строк, разбор блоков
  публикации) — бизнес-правила проекта, а не вёрстку.
- Помощники интерфейса, которые нужно проверять, держим отдельными `.ts`-модулями
  (`accordion-state.ts`, `carousel-state.ts`, `calendar-state.ts`, `range-state.ts`,
  `date-range-state.ts`, `date-mask.ts`): компоненты `.tsx` импортируют CSS и в тестах не поднимаются.
