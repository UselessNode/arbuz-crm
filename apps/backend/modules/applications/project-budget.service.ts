// Бизнес-логика бюджета заявки.
import { prisma } from '../../lib/prisma';
import { httpError } from '../../lib/http';
import type { CurrentUser } from '../files/files.service';
import { getApplicationForAccess } from './applications.service';

export interface BudgetInput {
  resource_type: string;
  unit_cost?: number | null;
  quantity?: number | null;
  own_funds?: number | null;
  grant_funds?: number | null;
  comment?: string | null;
}

function requiredText(value: unknown, field: string): string {
  const s = String(value ?? '').trim();
  if (!s) throw httpError(400, `Поле ${field} обязательно`, 'INVALID_BODY');
  return s.slice(0, 255);
}

function comment(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  const s = String(value).trim();
  return s.length ? s : null;
}

function money(value: unknown): number | null {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n)) throw httpError(400, 'Некорректная сумма', 'INVALID_MONEY');
  return n;
}

function quantity(value: unknown): number | null {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0) throw httpError(400, 'Некорректное количество', 'INVALID_QUANTITY');
  return n;
}

function serialize(item: {
  id: number;
  application_id: number;
  resource_type: string;
  unit_cost: unknown | null;
  quantity: number | null;
  own_funds: unknown | null;
  grant_funds: unknown | null;
  comment: string | null;
}) {
  return {
    id: item.id,
    applicationId: item.application_id,
    resourceType: item.resource_type,
    unitCost: item.unit_cost === null ? null : Number(item.unit_cost),
    quantity: item.quantity,
    ownFunds: item.own_funds === null ? null : Number(item.own_funds),
    grantFunds: item.grant_funds === null ? null : Number(item.grant_funds),
    comment: item.comment,
  };
}

export async function listBudget(user: CurrentUser, applicationId: number) {
  await getApplicationForAccess(user, applicationId, 'view');
  const items = await prisma.project_budget.findMany({
    where: { application_id: applicationId, deleted_at: null },
    orderBy: { id: 'asc' },
  });
  return items.map(serialize);
}

export async function createBudgetItem(user: CurrentUser, applicationId: number, input: BudgetInput) {
  await getApplicationForAccess(user, applicationId, 'edit');
  const item = await prisma.project_budget.create({
    data: {
      application_id: applicationId,
      resource_type: requiredText(input.resource_type, 'resource_type'),
      unit_cost: money(input.unit_cost),
      quantity: quantity(input.quantity),
      own_funds: money(input.own_funds),
      grant_funds: money(input.grant_funds),
      comment: comment(input.comment),
    },
  });
  return serialize(item);
}

export async function updateBudgetItem(
  user: CurrentUser,
  applicationId: number,
  itemId: number,
  input: Partial<BudgetInput>,
) {
  await getApplicationForAccess(user, applicationId, 'edit');
  const existing = await prisma.project_budget.findFirst({
    where: { id: itemId, application_id: applicationId, deleted_at: null },
  });
  if (!existing) throw httpError(404, 'Статья бюджета не найдена', 'BUDGET_NOT_FOUND');

  const data: Record<string, unknown> = {};
  if (input.resource_type !== undefined) data.resource_type = requiredText(input.resource_type, 'resource_type');
  if (input.unit_cost !== undefined) data.unit_cost = money(input.unit_cost);
  if (input.quantity !== undefined) data.quantity = quantity(input.quantity);
  if (input.own_funds !== undefined) data.own_funds = money(input.own_funds);
  if (input.grant_funds !== undefined) data.grant_funds = money(input.grant_funds);
  if (input.comment !== undefined) data.comment = comment(input.comment);

  const item = await prisma.project_budget.update({ where: { id: itemId }, data });
  return serialize(item);
}

export async function deleteBudgetItem(user: CurrentUser, applicationId: number, itemId: number): Promise<void> {
  await getApplicationForAccess(user, applicationId, 'edit');
  const existing = await prisma.project_budget.findFirst({
    where: { id: itemId, application_id: applicationId, deleted_at: null },
    select: { id: true },
  });
  if (!existing) throw httpError(404, 'Статья бюджета не найдена', 'BUDGET_NOT_FOUND');
  await prisma.project_budget.update({ where: { id: itemId }, data: { deleted_at: new Date() } });
}
