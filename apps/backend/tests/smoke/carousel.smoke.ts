// Смоук: переключение слайдов карусели.
//
// Логика чистая и живёт во фронтенде (`apps/frontend/src/components/ui/Container/carousel-state.ts`):
// проверяем закольцовывание переходов и устойчивость к пустому набору слайдов.
import { wrapIndex } from '../../../frontend/src/components/ui/Container/carousel-state';
import { createSmoke } from '../helpers/smoke';

const smoke = createSmoke('carousel (переключение слайдов)');

function main(): void {
  // Обычные переходы.
  smoke.eq('следующий слайд', wrapIndex(1, 3), 1);
  smoke.eq('последний слайд', wrapIndex(2, 3), 2);
  smoke.eq('шаг назад', wrapIndex(1, 3), 1);

  // Закольцовывание: назад с первого и вперёд с последнего.
  smoke.eq('назад с первого — на последний', wrapIndex(-1, 3), 2);
  smoke.eq('вперёд с последнего — на первый', wrapIndex(3, 3), 0);
  smoke.eq('назад с первого при двух слайдах', wrapIndex(-1, 2), 1);

  // Переход по точке-индикатору и большие шаги.
  smoke.eq('переход на средний слайд', wrapIndex(1, 4), 1);
  smoke.eq('шаг больше длины закольцовывается', wrapIndex(7, 3), 1);
  smoke.eq('отрицательный шаг больше длины закольцовывается', wrapIndex(-4, 3), 2);

  // Пустой набор и один слайд — переключать нечего.
  smoke.eq('пустой набор: нулевой индекс', wrapIndex(5, 0), 0);
  smoke.eq('один слайд: всегда нулевой', wrapIndex(-1, 1), 0);

  smoke.done();
}

main();
