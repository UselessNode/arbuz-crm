// Заявки seed: сама заявка и её вложенные части (состав, план, бюджет).
import { prisma } from '../lib/prisma';
import { log } from '../lib/logger';
import type { SeedBudgetItem, SeedMember, SeedPlan } from './data';

export interface ApplicationRecordInput {
  ownerId: number;
  title: string;
  tenderId: number | null;
  directionId: number | null;
  statusId: number;
  submittedAt: Date | null;
  idea: string;
  importance: string;
  goal: string;
  tasks: string;
  experience?: string;
  results?: string;
}

/** Создаёт заявку, если такой (владелец + заголовок) ещё нет. */
export async function ensureApplication(input: ApplicationRecordInput) {
  const existing = await prisma.applications.findFirst({
    where: { owner_id: input.ownerId, title: input.title },
  });
  if (existing) {
    log.info('seed: заявка уже существует', { id: existing.id, title: existing.title });
    return existing;
  }
  const application = await prisma.applications.create({
    data: {
      owner_id: input.ownerId,
      title: input.title,
      tender_id: input.tenderId,
      direction_id: input.directionId,
      status_id: input.statusId,
      submitted_at: input.submittedAt,
      idea_description: input.idea,
      importance_to_team: input.importance,
      project_goal: input.goal,
      project_tasks: input.tasks,
      implementation_experience: input.experience ?? null,
      results_description: input.results ?? null,
    },
  });
  log.info('seed: создана заявка', { id: application.id, title: application.title });
  return application;
}

/** Участник команды (согласие загружается вручную — путь в БД пустой). */
export async function ensureMember(applicationId: number, member: SeedMember): Promise<void> {
  const existing = await prisma.team_members.findFirst({
    where: { application_id: applicationId, surname: member.surname, name: member.name, deleted_at: null },
    select: { id: true },
  });
  if (existing) return;
  await prisma.team_members.create({
    data: {
      application_id: applicationId,
      surname: member.surname,
      name: member.name,
      patronymic: member.patronymic ?? null,
      tasks_in_project: member.tasks,
      is_coordinator: member.isCoordinator ?? false,
      is_responsible: member.isResponsible ?? false,
      is_adult: true,
      contact_info: 'demo@arbuz.local',
      // Файл согласия загружается вручную (в БД хранится путь к реальному файлу).
      consent_file_path: '',
    },
  });
}

/** Мероприятие плана проекта. */
export async function ensurePlan(applicationId: number, plan: SeedPlan): Promise<void> {
  const existing = await prisma.project_plans.findFirst({
    where: { application_id: applicationId, event_name: plan.event, deleted_at: null },
    select: { id: true },
  });
  if (existing) return;
  await prisma.project_plans.create({
    data: {
      application_id: applicationId,
      task: plan.task,
      event_name: plan.event,
      event_description: plan.description,
      start_date: new Date(plan.start),
      end_date: new Date(plan.end),
    },
  });
}

/** Статья бюджета заявки. */
export async function ensureBudgetItem(applicationId: number, item: SeedBudgetItem): Promise<void> {
  const existing = await prisma.project_budget.findFirst({
    where: { application_id: applicationId, resource_type: item.resource, deleted_at: null },
    select: { id: true },
  });
  if (existing) return;
  await prisma.project_budget.create({
    data: {
      application_id: applicationId,
      resource_type: item.resource,
      quantity: item.quantity,
      unit_cost: item.unitCost,
      own_funds: item.own,
      grant_funds: item.grant,
      comment: item.comment ?? null,
    },
  });
}
