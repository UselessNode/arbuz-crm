// Переходы состояния аккордеона. Вынесены из компонента отдельными чистыми функциями:
// их поведение (особенно идемпотентность раскрытия) проверяется смоук-тестом без DOM.

/**
 * Идемпотентно раскрывает секцию. Если ключ уже открыт, возвращается тот же объект,
 * поэтому повторный вызов не меняет состояние — это важно для `defaultOpen`:
 * в StrictMode эффект выполняется дважды, и «переключение» свернуло бы секцию обратно.
 */
export function openAccordionKey(keys: Set<string>, key: string, allowMultiple: boolean): Set<string> {
  if (keys.has(key)) return keys;
  const next = new Set(allowMultiple ? keys : []);
  next.add(key);
  return next;
}

/** Переключает секцию (клик по заголовку): открытую закрывает, закрытую открывает. */
export function toggleAccordionKey(keys: Set<string>, key: string, allowMultiple: boolean): Set<string> {
  if (keys.has(key)) {
    const next = new Set(keys);
    next.delete(key);
    return next;
  }
  return openAccordionKey(keys, key, allowMultiple);
}
