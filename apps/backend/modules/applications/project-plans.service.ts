// Бизнес-логика плана мероприятий заявки.
import { prisma } from '../../lib/prisma';
import { httpError } from '../../lib/http';
import type { CurrentUser } from '../files/files.service';
import { getApplicationForAccess } from './applications.service';

export interface ProjectPlanInput {
  task: string;
  event_name: string;
  event_description?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  results?: string | null;
  fixation_form?: string | null;
}

function text(value: unknown, max = 5000): string | null {
  if (value === undefined || value === null) return null;
  const s = String(value).trim();
  return s.length ? s.slice(0, max) : null;
}

function requiredText(value: unknown, field: string): string {
  const s = text(value);
  if (!s) throw httpError(400, `Поле ${field} обязательно`, 'INVALID_BODY');
  return s;
}

function dateValue(value: unknown): Date | null {
  if (value === undefined || value === null || value === '') return null;
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) throw httpError(400, 'Некорректная дата', 'INVALID_DATE');
  return d;
}

function serialize(plan: {
  id: number;
  application_id: number;
  task: string;
  event_name: string;
  event_description: string | null;
  start_date: Date | null;
  end_date: Date | null;
  results: string | null;
  fixation_form: string | null;
}) {
  return {
    id: plan.id,
    applicationId: plan.application_id,
    task: plan.task,
    eventName: plan.event_name,
    eventDescription: plan.event_description,
    startDate: plan.start_date,
    endDate: plan.end_date,
    results: plan.results,
    fixationForm: plan.fixation_form,
  };
}

export async function listPlans(user: CurrentUser, applicationId: number) {
  await getApplicationForAccess(user, applicationId, 'view');
  const plans = await prisma.project_plans.findMany({
    where: { application_id: applicationId, deleted_at: null },
    orderBy: { id: 'asc' },
  });
  return plans.map(serialize);
}

export async function createPlan(user: CurrentUser, applicationId: number, input: ProjectPlanInput) {
  await getApplicationForAccess(user, applicationId, 'edit');
  const plan = await prisma.project_plans.create({
    data: {
      application_id: applicationId,
      task: requiredText(input.task, 'task'),
      event_name: requiredText(input.event_name, 'event_name'),
      event_description: text(input.event_description),
      start_date: dateValue(input.start_date),
      end_date: dateValue(input.end_date),
      results: text(input.results),
      fixation_form: text(input.fixation_form),
    },
  });
  return serialize(plan);
}

export async function updatePlan(
  user: CurrentUser,
  applicationId: number,
  planId: number,
  input: Partial<ProjectPlanInput>,
) {
  await getApplicationForAccess(user, applicationId, 'edit');
  const existing = await prisma.project_plans.findFirst({
    where: { id: planId, application_id: applicationId, deleted_at: null },
  });
  if (!existing) throw httpError(404, 'Мероприятие не найдено', 'PLAN_NOT_FOUND');

  const data: Record<string, unknown> = {};
  if (input.task !== undefined) data.task = requiredText(input.task, 'task');
  if (input.event_name !== undefined) data.event_name = requiredText(input.event_name, 'event_name');
  if (input.event_description !== undefined) data.event_description = text(input.event_description);
  if (input.start_date !== undefined) data.start_date = dateValue(input.start_date);
  if (input.end_date !== undefined) data.end_date = dateValue(input.end_date);
  if (input.results !== undefined) data.results = text(input.results);
  if (input.fixation_form !== undefined) data.fixation_form = text(input.fixation_form);

  const plan = await prisma.project_plans.update({ where: { id: planId }, data });
  return serialize(plan);
}

export async function deletePlan(user: CurrentUser, applicationId: number, planId: number): Promise<void> {
  await getApplicationForAccess(user, applicationId, 'edit');
  const existing = await prisma.project_plans.findFirst({
    where: { id: planId, application_id: applicationId, deleted_at: null },
    select: { id: true },
  });
  if (!existing) throw httpError(404, 'Мероприятие не найдено', 'PLAN_NOT_FOUND');
  await prisma.project_plans.update({ where: { id: planId }, data: { deleted_at: new Date() } });
}
