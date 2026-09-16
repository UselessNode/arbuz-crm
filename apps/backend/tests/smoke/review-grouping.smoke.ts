// Смоук: группировка строк таблицы экспертиз и сборка критерия отбора для отчёта.
//
// Логика чистая и живёт во фронтенде (`apps/frontend/src/lib/review-grouping.ts`) —
// проверяется как бизнес-правило проекта, без БД и без рендера.
//
// Главное правило: в режимах без группировки строка = одна экспертиза,
// в режимах с группировкой строка = набор экспертиз.
import {
  ReviewGrouping,
  groupReviews,
  isReviewGrouping,
  scoreBucket,
  selectionForRows,
  type GroupingRow,
} from '../../../frontend/src/lib/review-grouping';
import { createSmoke } from '../helpers/smoke';

const smoke = createSmoke('review-grouping (режимы таблицы экспертиз)');

function row(overrides: Partial<GroupingRow> & { id: number }): GroupingRow {
  return {
    applicationId: overrides.id,
    applicationTitle: `Заявка ${overrides.id}`,
    tender: null,
    direction: null,
    expertId: 1,
    expertName: 'Эксперт 1',
    verdictId: null,
    verdictName: null,
    verdictTone: null,
    totalScore: null,
    text: null,
    rating: {},
    updatedAt: '2026-09-14T10:00:00.000Z',
    ...overrides,
  };
}

// 10 экспертиз: 5 заявок × 2 эксперта, 4 варианта вердикта.
const reviews: GroupingRow[] = Array.from({ length: 10 }, (_, index) =>
  row({
    id: index + 1,
    applicationId: Math.floor(index / 2) + 1,
    expertId: (index % 2) + 1,
    expertName: `Эксперт ${(index % 2) + 1}`,
    verdictId: (index % 4) + 1,
    verdictName: `Вердикт ${(index % 4) + 1}`,
    totalScore: 10 + index,
  }),
);

async function main(): Promise<void> {
  // Режим 0/1: одна строка на запись.
  const flat = groupReviews(reviews, ReviewGrouping.none);
  smoke.eq('без группировки: строк столько же, сколько экспертиз', flat.length, 10);
  smoke.eq('без группировки: строка ссылается на одну экспертизу', flat[0].reviewIds, [1]);
  smoke.eq('без группировки: подпись строки — заявка', flat[0].label, 'Заявка 1');

  // Режим 2: одна строка на эксперта.
  const byExpert = groupReviews(reviews, ReviewGrouping.expert);
  smoke.eq('по эксперту: строк — по числу экспертов', byExpert.length, 2);
  smoke.eq('по эксперту: в строке 5 экспертиз', byExpert[0].count, 5);
  smoke.eq('по эксперту: критерий отбора — эксперт', byExpert[0].selection, { expert_id: 1 });
  smoke.eq('по эксперту: средний балл считается по группе', byExpert[0].averageScore, 14);
  smoke.eq('по эксперту: заявок в группе', byExpert[0].applications, 5);

  // Режим 3: одна строка на вердикт.
  const byVerdict = groupReviews(reviews, ReviewGrouping.verdict);
  smoke.eq('по вердикту: строк — по числу вердиктов', byVerdict.length, 4);
  smoke.eq('по вердикту: критерий отбора — вердикт', byVerdict[0].selection, { status_id: 1 });

  // Режим 4: диапазоны оценки (шаг 5 баллов).
  const byScore = groupReviews(reviews, ReviewGrouping.score);
  smoke.eq('по оценке: диапазон 10–14', scoreBucket(10).label, '10–14');
  smoke.eq('по оценке: диапазон 15–19', scoreBucket(19).label, '15–19');
  smoke.eq('по оценке: без балла — отдельная группа', scoreBucket(null).label, 'Без оценки');
  smoke.ok('по оценке: строк меньше, чем записей', byScore.length < reviews.length, byScore.length);

  // Режим 5: периоды по дате обновления.
  const byDate = groupReviews(reviews, ReviewGrouping.date);
  smoke.eq('по дате: один месяц — одна строка', byDate.length, 1);
  smoke.eq('по дате: подпись периода', byDate[0].label, 'сентябрь 2026');

  // Вердикт без статуса не выносится в отчёт по вердикту — берём точный набор.
  const withoutVerdict = groupReviews([row({ id: 99, verdictId: null })], ReviewGrouping.verdict);
  smoke.eq('без вердикта: подпись группы', withoutVerdict[0].label, 'Вердикт не выставлен');
  smoke.eq('без вердикта: отбор по списку id', withoutVerdict[0].selection, { review_ids: [99] });

  // Критерий отчёта по выбранным строкам.
  smoke.eq('одна строка-группа: отбор — вся группа', selectionForRows([byExpert[0]]), { expert_id: 1 });
  smoke.eq(
    'несколько строк: отбор — точный список экспертиз',
    selectionForRows([byExpert[0], byExpert[1]]),
    { review_ids: [1, 3, 5, 7, 9, 2, 4, 6, 8, 10] },
  );
  smoke.eq('ничего не выбрано: отбора нет', selectionForRows([]), null);

  // Разбор значения из URL.
  smoke.ok('group=expert распознаётся', isReviewGrouping('expert'));
  smoke.ok('неизвестная группировка отклоняется', !isReviewGrouping('что-то'));

  smoke.done();
}

await main();
