// Смоук: переходы состояния аккордеона (чистая логика из `components/ui/Container/accordion-state.ts`).
//
// Регрессия, которую сторожит тест: раскрытие по умолчанию должно быть идемпотентным.
// В StrictMode эффект `defaultOpen` выполняется дважды; если бы он «переключал» секцию,
// второй вызов свернул бы её обратно — именно так аккордеоны в карточке заявки
// оказывались закрытыми при `defaultOpen`.
import { openAccordionKey, toggleAccordionKey } from '../../../frontend/src/components/ui/Container/accordion-state';
import { createSmoke } from '../helpers/smoke';

const smoke = createSmoke('accordion (состояние раскрытия)');

function main(): void {
  // Раскрытие идемпотентно: повторный вызов ничего не меняет.
  const once = openAccordionKey(new Set(), 'main', true);
  smoke.eq('раскрытие добавляет секцию', [...once], ['main']);
  const twice = openAccordionKey(once, 'main', true);
  smoke.ok('повторное раскрытие не сворачивает секцию', twice.has('main'));
  smoke.ok('повторное раскрытие возвращает тот же объект', twice === once);

  // Одиночный режим: раскрытие второй секции закрывает первую.
  const single = openAccordionKey(once, 'team', false);
  smoke.eq('одиночный режим оставляет одну секцию', [...single], ['team']);

  // Множественный режим: секции копятся.
  const multiple = openAccordionKey(once, 'team', true);
  smoke.eq('множественный режим оставляет обе секции', [...multiple].sort(), ['main', 'team']);

  // Переключение по клику — не идемпотентно: закрывает открытую секцию.
  smoke.ok('клик закрывает открытую секцию', !toggleAccordionKey(once, 'main', true).has('main'));
  smoke.ok('клик открывает закрытую секцию', toggleAccordionKey(new Set(), 'main', true).has('main'));
  smoke.ok(
    'в одиночном режиме клик по другой секции переключает на неё',
    [...toggleAccordionKey(once, 'team', false)].join() === 'team',
  );

  smoke.done();
}

main();
