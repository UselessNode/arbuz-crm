// Состояние карусели: переключение слайдов. Чистая логика — покрыта смоук-тестом
// (по образцу `accordion-state.ts`): переходы считаются без DOM и без React.

/**
 * Приводит номер слайда к допустимому диапазону с закольцовыванием.
 * Нужно для шага назад с первого слайда и вперёд — с последнего.
 */
export function wrapIndex(next: number, count: number): number {
  if (count <= 0) return 0;
  return ((next % count) + count) % count;
}
