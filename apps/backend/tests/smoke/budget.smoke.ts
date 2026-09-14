// Смоук: правила бюджета заявки (расчётная стоимость vs финансирование).
//
// Логика чистая и живёт во фронтенде (`apps/frontend/src/lib/budget.ts`) — здесь она
// проверяется как бизнес-правило проекта, без БД и без рендера.
import { budgetMismatch, budgetMismatchText, formatMoney, itemCost, itemTotal, sumBy } from '../../../frontend/src/lib/budget';
import { createSmoke } from '../helpers/smoke';

const smoke = createSmoke('budget (расчётная стоимость и финансирование)');

const items = [
  { quantity: 100, unitCost: 150, ownFunds: 5000, grantFunds: 10000 },
  { quantity: 2, unitCost: 12000, ownFunds: 0, grantFunds: 24000 },
  { quantity: 100, unitCost: 300, ownFunds: 10000, grantFunds: 20000 },
];

async function main(): Promise<void> {
  // Статья: стоимость = кол-во × цена, финансирование = свои + грант.
  smoke.eq('стоимость статьи', itemCost(items[0]), 15000);
  smoke.eq('финансирование статьи', itemTotal(items[0]), 15000);
  smoke.eq('сумма по статьям', sumBy(items, itemCost), 15000 + 24000 + 30000);
  smoke.eq('нулевые значения не ломают расчёт', itemCost({ quantity: null, unitCost: null }), 0);

  // Равные суммы — расхождений нет.
  smoke.eq('равные суммы: расхождений нет', budgetMismatch(69000, 69000).tone, 'ok');
  smoke.eq('текст при отсутствии расхождений пуст', budgetMismatchText(budgetMismatch(100, 100)), '');

  // Стоимость больше финансирования — ошибка с нехваткой.
  const shortfall = budgetMismatch(69000, 50000);
  smoke.eq('нехватка средств: тон ошибки', shortfall.tone, 'error');
  smoke.ok('нехватка средств: разница', shortfall.tone !== 'ok' && shortfall.diff === 19000, shortfall);
  smoke.ok(
    'нехватка средств: текст содержит сумму',
    budgetMismatchText(shortfall).includes('не хватает') && budgetMismatchText(shortfall).includes(formatMoney(19000)),
    budgetMismatchText(shortfall),
  );

  // Финансирование больше стоимости — предупреждение.
  const excess = budgetMismatch(50000, 69000);
  smoke.eq('переизбыток средств: тон предупреждения', excess.tone, 'warning');
  smoke.ok('переизбыток средств: разница', excess.tone !== 'ok' && excess.diff === 19000, excess);
  smoke.ok('переизбыток средств: текст предупреждает', budgetMismatchText(excess).includes('проверьте статьи'));

  // Разделитель разрядов в ru-RU — неразрывный пробел, поэтому пробелы нормализуем.
  smoke.eq('формат денежной суммы', formatMoney(69000).replace(/\s/g, ' '), '69 000');

  smoke.done();
}

await main();
