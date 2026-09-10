// Бизнес-логика участников команды заявки.
import { prisma } from '../../lib/prisma';
import { httpError } from '../../lib/http';
import type { CurrentUser } from '../files/files.service';
import { getApplicationForAccess } from './applications.service';

export interface TeamMemberInput {
  surname: string;
  name: string;
  patronymic?: string | null;
  tasks_in_project?: string | null;
  contact_info?: string | null;
  social_media_links?: string | null;
  forum_url?: string | null;
  is_responsible?: boolean;
  is_coordinator?: boolean;
  education?: string | null;
  work_experience?: string | null;
  is_adult?: boolean;
}

function text(value: unknown, max = 255): string | null {
  if (value === undefined || value === null) return null;
  const s = String(value).trim();
  return s.length ? s.slice(0, max) : null;
}

function requiredText(value: unknown, field: string, max = 100): string {
  const s = text(value, max);
  if (!s) throw httpError(400, `Поле ${field} обязательно`, 'INVALID_BODY');
  return s;
}

function bool(value: unknown): boolean | undefined {
  if (value === undefined || value === null) return undefined;
  return Boolean(value);
}

function serialize(member: {
  id: number;
  application_id: number;
  surname: string;
  name: string;
  patronymic: string | null;
  tasks_in_project: string | null;
  contact_info: string | null;
  social_media_links: string | null;
  forum_url: string | null;
  is_responsible: boolean | null;
  is_coordinator: boolean | null;
  education: string | null;
  work_experience: string | null;
  is_adult: boolean | null;
  consent_file_path: string;
}) {
  return {
    id: member.id,
    applicationId: member.application_id,
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
  };
}

export async function listTeamMembers(user: CurrentUser, applicationId: number) {
  await getApplicationForAccess(user, applicationId, 'view');
  const members = await prisma.team_members.findMany({
    where: { application_id: applicationId, deleted_at: null },
    orderBy: { id: 'asc' },
  });
  return members.map(serialize);
}

export async function createTeamMember(user: CurrentUser, applicationId: number, input: TeamMemberInput) {
  await getApplicationForAccess(user, applicationId, 'edit');
  const member = await prisma.team_members.create({
    data: {
      application_id: applicationId,
      surname: requiredText(input.surname, 'surname'),
      name: requiredText(input.name, 'name'),
      patronymic: text(input.patronymic),
      tasks_in_project: text(input.tasks_in_project),
      contact_info: text(input.contact_info),
      social_media_links: text(input.social_media_links),
      forum_url: text(input.forum_url),
      is_responsible: bool(input.is_responsible) ?? null,
      is_coordinator: bool(input.is_coordinator) ?? null,
      education: text(input.education),
      work_experience: text(input.work_experience),
      is_adult: bool(input.is_adult) ?? null,
      consent_file_path: '',
    },
  });
  return serialize(member);
}

export async function updateTeamMember(
  user: CurrentUser,
  applicationId: number,
  memberId: number,
  input: Partial<TeamMemberInput>,
) {
  await getApplicationForAccess(user, applicationId, 'edit');
  const existing = await prisma.team_members.findFirst({
    where: { id: memberId, application_id: applicationId, deleted_at: null },
  });
  if (!existing) throw httpError(404, 'Участник команды не найден', 'TEAM_MEMBER_NOT_FOUND');

  const data: Record<string, unknown> = {};
  if (input.surname !== undefined) data.surname = requiredText(input.surname, 'surname');
  if (input.name !== undefined) data.name = requiredText(input.name, 'name');
  if (input.patronymic !== undefined) data.patronymic = text(input.patronymic);
  if (input.tasks_in_project !== undefined) data.tasks_in_project = text(input.tasks_in_project);
  if (input.contact_info !== undefined) data.contact_info = text(input.contact_info);
  if (input.social_media_links !== undefined) data.social_media_links = text(input.social_media_links);
  if (input.forum_url !== undefined) data.forum_url = text(input.forum_url);
  if (input.is_responsible !== undefined) data.is_responsible = bool(input.is_responsible) ?? null;
  if (input.is_coordinator !== undefined) data.is_coordinator = bool(input.is_coordinator) ?? null;
  if (input.education !== undefined) data.education = text(input.education);
  if (input.work_experience !== undefined) data.work_experience = text(input.work_experience);
  if (input.is_adult !== undefined) data.is_adult = bool(input.is_adult) ?? null;

  const member = await prisma.team_members.update({ where: { id: memberId }, data });
  return serialize(member);
}

export async function deleteTeamMember(user: CurrentUser, applicationId: number, memberId: number): Promise<void> {
  await getApplicationForAccess(user, applicationId, 'edit');
  const existing = await prisma.team_members.findFirst({
    where: { id: memberId, application_id: applicationId, deleted_at: null },
    select: { id: true },
  });
  if (!existing) throw httpError(404, 'Участник команды не найден', 'TEAM_MEMBER_NOT_FOUND');
  await prisma.team_members.update({ where: { id: memberId }, data: { deleted_at: new Date() } });
}
