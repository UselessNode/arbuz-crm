// Расчёты бюджета заявки: расчётная стоимость статей и её сверка с финансированием.
//
// Расчётная стоимость статьи — количество × цена за единицу.
// Финансирование статьи — собственные (привлечённые) средства + средства гранта.
// По заявке в целом эти суммы должны совпадать (см. правило в `budgetMismatch`).
export interface BudgetAmounts {
  quantity: number | null;
  unitCost: number | null;
  ownFunds: number | null;
  grantFunds: number | null;
}

/** Расчётная стоимость статьи: количество × цена за единицу. */
export function itemCost(item: Pick<BudgetAmounts, 'quantity' | 'unitCost'>): number {
  return (item.quantity ?? 0) * (item.unitCost ?? 0);
}

/** Финансирование статьи: собственные (привлечённые) + средства гранта. */
export function itemTotal(item: Pick<BudgetAmounts, 'ownFunds' | 'grantFunds'>): number {
  return (item.ownFunds ?? 0) + (item.grantFunds ?? 0);
}

/** Сумма по списку статей. */
export function sumBy<T>(items: readonly T[], pick: (item: T) => number): number {
  return items.reduce((acc, item) => acc + pick(item), 0);
}

export type BudgetMismatch =
  | { tone: 'ok'; cost: number; funding: number }
  | { tone: 'error'; cost: number; funding: number; diff: number }
  | { tone: 'warning'; cost: number; funding: number; diff: number };

/**
 * Сверка расчётной стоимости заявки с финансированием:
 *   cost > funding — ошибка (не хватает средств);
 *   cost < funding — предупреждение (переизбыток средств);
 *   cost = funding — расхождений нет.
 */
export function budgetMismatch(cost: number, funding: number): BudgetMismatch {
  if (cost === funding) return { tone: 'ok', cost, funding };
  const diff = Math.abs(cost - funding);
  return cost > funding ? { tone: 'error', cost, funding, diff } : { tone: 'warning', cost, funding, diff };
}

/** Денежная сумма для интерфейса (без копеек, разделитель разрядов). */
export function formatMoney(value: number | null): string {
  return value === null ? '—' : value.toLocaleString('ru-RU');
}

/** Текст сообщения о расхождении (пустая строка, если расхождений нет). */
export function budgetMismatchText(result: BudgetMismatch): string {
  if (result.tone === 'ok') return '';
  if (result.tone === 'error') {
    return `Расчётная стоимость (${formatMoney(result.cost)} ₽) больше финансирования (${formatMoney(result.funding)} ₽): не хватает ${formatMoney(result.diff)} ₽.`;
  }
  return `Финансирование (${formatMoney(result.funding)} ₽) больше расчётной стоимости (${formatMoney(result.cost)} ₽) на ${formatMoney(result.diff)} ₽ — проверьте статьи.`;
}
