// Бизнес-логика заявок: доступ по ролям, CRUD, отправка на проверку.
import { RoleType } from '@arbuz/shared';
import { prisma } from '../../lib/prisma';
import { httpError } from '../../lib/http';
import { APPLICATION_STATUS_NAMES } from '../../lib/app-status';
import type { CurrentUser } from '../files/files.service';

export type AccessMode = 'view' | 'edit' | 'submit' | 'delete';

export interface ApplicationStatus {
  id: number;
  name: string;
  is_editable: boolean | null;
  is_deletable: boolean | null;
}

export interface ApplicationWithStatus {
  id: number;
  owner_id: number | null;
  title: string;
  tender_id: number | null;
  direction_id: number | null;
  status_id: number;
  idea_description: string;
  importance_to_team: string;
  project_goal: string;
  project_tasks: string;
  implementation_experience: string | null;
  results_description: string | null;
  submitted_at: Date | null;
  created_at: Date;
  updated_at: Date;
  application_statuses: ApplicationStatus | null;
}

function parseId(raw: string | undefined): number {
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) {
    throw httpError(400, 'Некорректный идентификатор', 'INVALID_ID');
  }
  return value;
}

async function isExpertAssigned(applicationId: number, expertId: number): Promise<boolean> {
  const review = await prisma.application_reviews.findFirst({
    where: { application_id: applicationId, expert_id: expertId, deleted_at: null },
    select: { id: true },
  });
  return Boolean(review);
}

/** Загружает заявку (со статусом) и проверяет право по заданному режиму доступа. */
export async function getApplicationForAccess(
  user: CurrentUser,
  applicationId: number,
  mode: AccessMode,
): Promise<ApplicationWithStatus> {
  const application = await prisma.applications.findUnique({
    where: { id: applicationId },
    include: { application_statuses: true },
  });
  if (!application || application.deleted_at) {
    throw httpError(404, 'Заявка не найдена', 'APPLICATION_NOT_FOUND');
  }
  const status = application.application_statuses;

  const isAdmin = user.role === RoleType.admin;
  const isOwner = application.owner_id === user.id;

  if (mode === 'view') {
    const assigned = !isAdmin && !isOwner ? await isExpertAssigned(applicationId, user.id) : false;
    if (!isAdmin && !isOwner && !assigned) {
      throw httpError(403, 'Нет доступа к этой заявке', 'FORBIDDEN');
    }
    return application;
  }

  if (mode === 'edit') {
    // Владелец может редактировать свою заявку (в т.ч. созданную администратором для него)
    // независимо от факта отправки; администратор — всегда.
    if (!isAdmin && !isOwner) {
      throw httpError(403, 'Заявку нельзя редактировать', 'APPLICATION_NOT_EDITABLE');
    }
    return application;
  }

  if (mode === 'submit') {
    if (!isAdmin && !(isOwner && !application.submitted_at)) {
      throw httpError(403, 'Заявку нельзя отправить', 'APPLICATION_NOT_SUBMITTABLE');
    }
    return application;
  }

  // delete
  const ownerCanDelete = isOwner && !application.submitted_at && Boolean(status?.is_deletable);
  if (!isAdmin && !ownerCanDelete) {
    throw httpError(403, 'Заявку нельзя удалить', 'APPLICATION_NOT_DELETABLE');
  }
  return application;
}

export async function listApplications(
  user: CurrentUser,
  filter: { limit: number; offset: number },
): Promise<{ applications: unknown[]; total: number }> {
  const where =
    user.role === RoleType.admin
      ? { deleted_at: null }
      : user.role === RoleType.expert
        ? { deleted_at: null, application_reviews: { some: { expert_id: user.id, deleted_at: null } } }
        : { deleted_at: null, owner_id: user.id };

  const [rows, total] = await Promise.all([
    prisma.applications.findMany({
      where,
      orderBy: { created_at: 'desc' },
      skip: filter.offset,
      take: filter.limit,
      select: {
        id: true,
        title: true,
        owner_id: true,
        tender_id: true,
        direction_id: true,
        status_id: true,
        submitted_at: true,
        created_at: true,
        updated_at: true,
        application_statuses: { select: { id: true, name: true } },
        tenders: { select: { id: true, name: true } },
        directions: { select: { id: true, name: true } },
        users: { select: { id: true, name: true, surname: true, patronymic: true } },
      },
    }),
    prisma.applications.count({ where }),
  ]);

  return {
    total,
    applications: rows.map((row) => ({
      id: row.id,
      title: row.title,
      ownerId: row.owner_id,
      ownerName: row.users
        ? [row.users.surname, row.users.name, row.users.patronymic].filter(Boolean).join(' ') || '—'
        : '—',
      tenderId: row.tender_id,
      directionId: row.direction_id,
      statusId: row.status_id,
      status: row.application_statuses ? { id: row.application_statuses.id, name: row.application_statuses.name } : null,
      tender: row.tenders?.name ?? null,
      direction: row.directions?.name ?? null,
      submittedAt: row.submitted_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    })),
  };
}

export interface ApplicationInput {
  title: string;
  idea_description: string;
  importance_to_team: string;
  project_goal: string;
  project_tasks: string;
  implementation_experience?: string | null;
  results_description?: string | null;
  tender_id?: number | null;
  direction_id?: number | null;
  owner_id?: number | null; // только администратор
}

function validateInput(input: ApplicationInput) {
  const title = String(input.title ?? '').trim();
  const idea = String(input.idea_description ?? '').trim();
  const importance = String(input.importance_to_team ?? '').trim();
  const goal = String(input.project_goal ?? '').trim();
  const tasks = String(input.project_tasks ?? '').trim();
  if (!title || !idea || !importance || !goal || !tasks) {
    throw httpError(400, 'Не заполнены обязательные поля заявки', 'INVALID_BODY');
  }
  return {
    title,
    idea_description: idea,
    importance_to_team: importance,
    project_goal: goal,
    project_tasks: tasks,
    implementation_experience: optionalText(input.implementation_experience),
    results_description: optionalText(input.results_description),
  };
}

function optionalText(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text.length ? text : null;
}

function optionalId(value: unknown): number | null {
  if (value === undefined || value === null || value === '') return null;
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) throw httpError(400, 'Некорректный идентификатор', 'INVALID_ID');
  return id;
}

export type ApplicationValidationIssueCode = 'NO_MEMBERS' | 'NO_ADULT_COORDINATOR' | 'MISSING_CONSENT';

export interface ApplicationValidationIssue {
  code: ApplicationValidationIssueCode;
  message: string;
  /** Для MISSING_CONSENT — id участников без файла согласия. */
  teamMemberIds?: number[];
}

export interface ApplicationValidationResult {
  valid: boolean;
  issues: ApplicationValidationIssue[];
}

/**
 * Проверка готовности заявки к отправке:
 *  - не менее одного участника;
 *  - есть совершеннолетний координатор;
 *  - у каждого участника загружен файл согласия.
 * Используется и при отправке, и для предпросмотра в UI.
 */
export async function validateApplication(applicationId: number): Promise<ApplicationValidationResult> {
  const members = await prisma.team_members.findMany({
    where: { application_id: applicationId, deleted_at: null },
    select: {
      id: true,
      is_coordinator: true,
      is_adult: true,
      consent_files: { where: { deleted_at: null }, select: { id: true } },
    },
    orderBy: { id: 'asc' },
  });

  const issues: ApplicationValidationIssue[] = [];
  if (members.length === 0) {
    issues.push({ code: 'NO_MEMBERS', message: 'В заявке должен быть хотя бы один участник' });
  } else if (!members.some((member) => member.is_coordinator && member.is_adult)) {
    issues.push({ code: 'NO_ADULT_COORDINATOR', message: 'Нужен совершеннолетний координатор' });
  }

  const withoutConsent = members.filter((member) => member.consent_files.length === 0).map((member) => member.id);
  if (withoutConsent.length > 0) {
    issues.push({ code: 'MISSING_CONSENT', message: 'У части участников нет файла согласия', teamMemberIds: withoutConsent });
  }

  return { valid: issues.length === 0, issues };
}

/** Возвращает id системного статуса по имени; ошибка, если статус не заведён. */
async function requireStatusIdByName(name: string): Promise<number> {
  const status = await prisma.application_statuses.findFirst({
    where: { name, deleted_at: null },
    select: { id: true },
  });
  if (!status) {
    throw httpError(500, `Статус "${name}" не найден — проверьте справочник статусов (seed)`, 'STATUS_NOT_FOUND');
  }
  return status.id;
}

/** Проверяет существование конкурса/направления и их согласованность. */
async function assertLinkTargets(tenderId: number | null, directionId: number | null): Promise<void> {
  if (tenderId !== null) {
    const tender = await prisma.tenders.findFirst({ where: { id: tenderId, deleted_at: null }, select: { id: true } });
    if (!tender) throw httpError(400, 'Конкурс не найден', 'TENDER_NOT_FOUND');
  }
  if (directionId !== null) {
    const direction = await prisma.directions.findFirst({
      where: { id: directionId, deleted_at: null },
      select: { id: true, tender_id: true },
    });
    if (!direction) throw httpError(400, 'Направление не найдено', 'DIRECTION_NOT_FOUND');
    if (tenderId !== null && direction.tender_id !== null && direction.tender_id !== tenderId) {
      throw httpError(400, 'Направление не относится к выбранному конкурсу', 'DIRECTION_TENDER_MISMATCH');
    }
  }
}

export async function getApplicationDetail(user: CurrentUser, applicationId: number) {
  const application = await prisma.applications.findUnique({
    where: { id: applicationId },
    include: {
      application_statuses: true,
      tenders: true,
      directions: true,
      users: { select: { id: true, email: true, name: true, surname: true, patronymic: true } },
      team_members: {
        where: { deleted_at: null },
        orderBy: { id: 'asc' },
        include: { consent_files: { where: { deleted_at: null }, select: { id: true } } },
      },
      project_plans: { where: { deleted_at: null }, orderBy: { id: 'asc' } },
      project_budget: { where: { deleted_at: null }, orderBy: { id: 'asc' } },
      additional_materials: { where: { deleted_at: null }, orderBy: { id: 'asc' } },
      application_reviews: {
        where: { deleted_at: null },
        orderBy: { id: 'asc' },
        include: { users: { select: { id: true, name: true, surname: true, patronymic: true, email: true } } },
      },
    },
  });

  if (!application) throw httpError(404, 'Заявка не найдена', 'APPLICATION_NOT_FOUND');

  await getApplicationForAccess(user, applicationId, 'view'); // проверка прав

  return {
    id: application.id,
    title: application.title,
    ownerId: application.owner_id,
    owner: application.users
      ? {
          id: application.users.id,
          email: application.users.email,
          name: application.users.name,
          surname: application.users.surname,
          patronymic: application.users.patronymic,
        }
      : null,
    tender: application.tenders
      ? { id: application.tenders.id, name: application.tenders.name, expertsCount: application.tenders.experts_count }
      : null,
    direction: application.directions ? { id: application.directions.id, name: application.directions.name } : null,
    status: application.application_statuses
      ? {
          id: application.application_statuses.id,
          name: application.application_statuses.name,
          isEditable: application.application_statuses.is_editable,
          isDeletable: application.application_statuses.is_deletable,
        }
      : null,
    ideaDescription: application.idea_description,
    importanceToTeam: application.importance_to_team,
    projectGoal: application.project_goal,
    projectTasks: application.project_tasks,
    implementationExperience: application.implementation_experience,
    resultsDescription: application.results_description,
    submittedAt: application.submitted_at,
    createdAt: application.created_at,
    updatedAt: application.updated_at,
    teamMembers: application.team_members.map((member) => ({
      id: member.id,
      surname: member.surname,
      name: member.name,
      patronymic: member.patronymic,
      tasksInProject: member.tasks_in_project,
      contactInfo: member.contact_info,
      socialMediaLinks: member.social_media_links,
      forumUrl: member.forum_url,
      isResponsible: member.is_responsible,
      isCoordinator: member.is_coordinator,
      education: member.education,
      workExperience: member.work_experience,
      isAdult: member.is_adult,
      consentFilePath: member.consent_file_path,
      hasConsent: member.consent_files.length > 0,
      consentsCount: member.consent_files.length,
    })),
    projectPlans: application.project_plans.map((plan) => ({
      id: plan.id,
      task: plan.task,
      eventName: plan.event_name,
      eventDescription: plan.event_description,
      startDate: plan.start_date,
      endDate: plan.end_date,
      results: plan.results,
      fixationForm: plan.fixation_form,
    })),
    projectBudget: application.project_budget.map((item) => ({
      id: item.id,
      resourceType: item.resource_type,
      unitCost: item.unit_cost === null ? null : Number(item.unit_cost),
      quantity: item.quantity,
      ownFunds: item.own_funds === null ? null : Number(item.own_funds),
      grantFunds: item.grant_funds === null ? null : Number(item.grant_funds),
      comment: item.comment,
    })),
    materials: application.additional_materials.map((m) => ({
      id: m.id,
      fileName: m.file_name,
      fileType: m.file_type,
      sizeBytes: m.file_bytes_size === null || m.file_bytes_size === undefined ? null : Number(m.file_bytes_size),
      comment: m.comment,
      uploadedAt: m.uploaded_at,
    })),
    reviews: application.application_reviews.map((review) => ({
      id: review.id,
      expert: review.users
        ? {
            id: review.users.id,
            email: review.users.email,
            name: review.users.name,
            surname: review.users.surname,
            patronymic: review.users.patronymic,
          }
        : null,
      status: review.review_status,
      text: review.review_text,
      rating: review.rating,
      totalScore: review.total_score,
      updatedAt: review.updated_at,
    })),
  };
}

export async function createApplication(user: CurrentUser, input: ApplicationInput) {
  const data = validateInput(input);
  const isAdmin = user.role === RoleType.admin;
  const ownerId = isAdmin ? optionalId(input.owner_id) ?? user.id : user.id;
  const tenderId = optionalId(input.tender_id);
  const directionId = optionalId(input.direction_id);
  await assertLinkTargets(tenderId, directionId);
  const statusId = await requireStatusIdByName(APPLICATION_STATUS_NAMES.draft);

  const application = await prisma.applications.create({
    data: {
      owner_id: ownerId,
      title: data.title,
      idea_description: data.idea_description,
      importance_to_team: data.importance_to_team,
      project_goal: data.project_goal,
      project_tasks: data.project_tasks,
      implementation_experience: data.implementation_experience,
      results_description: data.results_description,
      tender_id: tenderId,
      direction_id: directionId,
      status_id: statusId,
    },
  });
  return getApplicationDetail(user, application.id);
}

export async function updateApplication(
  user: CurrentUser,
  applicationId: number,
  patch: Partial<ApplicationInput> & { status_id?: unknown },
) {
  await getApplicationForAccess(user, applicationId, 'edit');
  const existing = await prisma.applications.findUnique({ where: { id: applicationId } });
  if (!existing || existing.deleted_at) throw httpError(404, 'Заявка не найдена', 'APPLICATION_NOT_FOUND');

  const merged: ApplicationInput = {
    title: (patch.title as string) ?? existing.title,
    idea_description: (patch.idea_description as string) ?? existing.idea_description,
    importance_to_team: (patch.importance_to_team as string) ?? existing.importance_to_team,
    project_goal: (patch.project_goal as string) ?? existing.project_goal,
    project_tasks: (patch.project_tasks as string) ?? existing.project_tasks,
    implementation_experience:
      patch.implementation_experience !== undefined ? patch.implementation_experience : existing.implementation_experience,
    results_description:
      patch.results_description !== undefined ? patch.results_description : existing.results_description,
    tender_id: patch.tender_id !== undefined ? patch.tender_id : existing.tender_id,
    direction_id: patch.direction_id !== undefined ? patch.direction_id : existing.direction_id,
  };
  const validated = validateInput(merged);

  const tenderId = optionalId(merged.tender_id);
  const directionId = optionalId(merged.direction_id);
  await assertLinkTargets(tenderId, directionId);

  const data: Record<string, unknown> = {
    title: validated.title,
    idea_description: validated.idea_description,
    importance_to_team: validated.importance_to_team,
    project_goal: validated.project_goal,
    project_tasks: validated.project_tasks,
    implementation_experience: validated.implementation_experience,
    results_description: validated.results_description,
    tender_id: tenderId,
    direction_id: directionId,
  };
  if (patch.status_id !== undefined && user.role === RoleType.admin) {
    const statusId = optionalId(patch.status_id);
    if (statusId === null) throw httpError(400, 'Статус обязателен', 'STATUS_REQUIRED');
    const status = await prisma.application_statuses.findFirst({
      where: { id: statusId, deleted_at: null },
      select: { id: true },
    });
    if (!status) throw httpError(400, 'Статус не найден', 'STATUS_NOT_FOUND');
    data.status_id = statusId;
  }

  await prisma.applications.update({ where: { id: applicationId }, data });
  return getApplicationDetail(user, applicationId);
}

export async function deleteApplication(user: CurrentUser, applicationId: number): Promise<void> {
  await getApplicationForAccess(user, applicationId, 'delete');
  await prisma.applications.update({ where: { id: applicationId }, data: { deleted_at: new Date() } });
}

export async function submitApplication(user: CurrentUser, applicationId: number) {
  await getApplicationForAccess(user, applicationId, 'submit');

  const validation = await validateApplication(applicationId);
  if (!validation.valid) {
    throw httpError(
      400,
      `Заявка не прошла проверку: ${validation.issues.map((issue) => issue.message).join('; ')}`,
      'APPLICATION_INVALID',
    );
  }

  const reviewStatusId = await requireStatusIdByName(APPLICATION_STATUS_NAMES.submitted);

  await prisma.applications.update({
    where: { id: applicationId },
    data: { submitted_at: new Date(), status_id: reviewStatusId },
  });
  return getApplicationDetail(user, applicationId);
}

export { parseId };
