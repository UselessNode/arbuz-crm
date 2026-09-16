// Смоук: ползунок с двумя границами (выбор диапазона чисел).
//
// Логика чистая и живёт во фронтенде (`apps/frontend/src/components/ui/Form/range-state.ts`):
// проверяем прижатие к границам и шагу и то, что границы не перескакивают друг через друга.
import { clampToStep, moveRangeHandle, rangePercent } from '../../../frontend/src/components/ui/Form/range-state';
import { createSmoke } from '../helpers/smoke';

const smoke = createSmoke('range-slider (диапазон числовых значений)');

const bounds = { min: 0, max: 100, step: 1 };

function main(): void {
  // Прижатие к границам.
  smoke.eq('ниже минимума — к минимуму', clampToStep(-10, 0, 100, 1), 0);
  smoke.eq('выше максимума — к максимуму', clampToStep(150, 0, 100, 1), 100);
  smoke.eq('значение в границах не меняется', clampToStep(42, 0, 100, 1), 42);
  smoke.eq('нечисловое значение — минимум', clampToStep(Number.NaN, 5, 100, 1), 5);

  // Кратность шага и отсутствие плавающего «хвоста».
  smoke.eq('округление по шагу 5', clampToStep(12, 0, 100, 5), 10);
  smoke.eq('округление по шагу 5 вверх', clampToStep(13, 0, 100, 5), 15);
  smoke.eq('дробный шаг без хвоста', clampToStep(0.3, 0, 1, 0.1), 0.3);
  smoke.eq('шаг 0 означает «без округления»', clampToStep(3.7, 0, 10, 0), 3.7);

  // Обычные перемещения границ.
  smoke.eq(
    'двигаем нижнюю границу',
    moveRangeHandle({ from: 10, to: 50 }, 'from', 25, bounds),
    { from: 25, to: 50 },
  );
  smoke.eq(
    'двигаем верхнюю границу',
    moveRangeHandle({ from: 10, to: 50 }, 'to', 80, bounds),
    { from: 10, to: 80 },
  );

  // Границы не перескакивают друг через друга.
  smoke.eq(
    'нижняя граница не заходит за верхнюю',
    moveRangeHandle({ from: 10, to: 50 }, 'from', 90, bounds),
    { from: 50, to: 50 },
  );
  smoke.eq(
    'верхняя граница не заходит за нижнюю',
    moveRangeHandle({ from: 40, to: 60 }, 'to', 5, bounds),
    { from: 40, to: 40 },
  );
  smoke.eq(
    'границы могут сойтись',
    moveRangeHandle({ from: 40, to: 60 }, 'from', 60, bounds),
    { from: 60, to: 60 },
  );

  // Доля значения на шкале — для заливки отрезка.
  smoke.eq('начало шкалы', rangePercent(0, 0, 100), 0);
  smoke.eq('середина шкалы', rangePercent(50, 0, 100), 50);
  smoke.eq('конец шкалы', rangePercent(100, 0, 100), 100);
  smoke.eq('значение вне шкалы ограничивается', rangePercent(150, 0, 100), 100);
  smoke.eq('нулевая длина шкалы не делит на ноль', rangePercent(5, 10, 10), 0);

  smoke.done();
}

main();
