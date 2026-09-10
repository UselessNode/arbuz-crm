// Бизнес-логика файлов заявки: права доступа, папки приложений, квоты.
import { RoleType } from '@arbuz/shared';
import { prisma } from '../../lib/prisma';
import { httpError } from '../../lib/http';

export interface CurrentUser {
  id: number;
  email: string;
  role: RoleType;
}

export interface ApplicationBrief {
  id: number;
  owner_id: number | null;
  title: string;
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

/** Метка времени папки приложения: 20260908_1430. */
export function formatFolderTimestamp(date: Date): string {
  return (
    `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}` +
    `_${pad(date.getHours())}${pad(date.getMinutes())}`
  );
}

/** Достаёт каталог приложения из относительного пути вида uploads/<folder>/... */
export function folderFromPath(relativePath: string): string {
  const segments = relativePath.split('/');
  if (segments[0] !== 'uploads' || segments.length < 2) {
    throw httpError(400, 'Повреждён путь файла', 'INVALID_FILE_PATH');
  }
  return segments[1];
}

/**
 * Каталог приложения (например "123-456-20260908_1430").
 * Определяется по уже загруженным файлам, иначе создаётся по шаблону
 * <owner_id>-<application_id>-<время>. Каталог должен быть единственным на заявку.
 */
export async function resolveApplicationFolder(applicationId: number, ownerId: number | null): Promise<string> {
  const material = await prisma.additional_materials.findFirst({
    where: { application_id: applicationId, deleted_at: null },
    select: { file_path: true },
    orderBy: { id: 'asc' },
  });
  if (material) return folderFromPath(material.file_path);

  const consent = await prisma.consent_files.findFirst({
    where: { deleted_at: null, team_members: { application_id: applicationId, deleted_at: null } },
    select: { file_path: true },
    orderBy: { id: 'asc' },
  });
  if (consent) return folderFromPath(consent.file_path);

  return `${ownerId ?? 'u'}-${applicationId}-${formatFolderTimestamp(new Date())}`;
}

/** Суммарный объём файлов заявки (прикреплённые материалы + согласия). */
export async function applicationUsedBytes(applicationId: number): Promise<number> {
  const [materials, consents] = await Promise.all([
    prisma.additional_materials.aggregate({
      where: { application_id: applicationId, deleted_at: null },
      _sum: { file_bytes_size: true },
    }),
    prisma.consent_files.aggregate({
      where: { deleted_at: null, team_members: { application_id: applicationId, deleted_at: null } },
      _sum: { file_size: true },
    }),
  ]);
  return Number(materials._sum.file_bytes_size ?? 0) + Number(consents._sum.file_size ?? 0);
}

/**
 * Возвращает заявку и проверяет право управления файлами:
 * владелец заявки либо администратор.
 */
export async function requireManageableApplication(
  user: CurrentUser,
  applicationId: number,
): Promise<ApplicationBrief> {
  const application = await prisma.applications.findUnique({ where: { id: applicationId } });
  if (!application || application.deleted_at) {
    throw httpError(404, 'Заявка не найдена', 'APPLICATION_NOT_FOUND');
  }
  if (user.role !== RoleType.admin && application.owner_id !== user.id) {
    throw httpError(403, 'Нет доступа к файлам этой заявки', 'FORBIDDEN');
  }
  return application;
}

/**
 * Проверяет право просмотра файлов заявки: владелец, администратор
 * или назначенный на заявку эксперт (управление остаётся за requireManageableApplication).
 */
export async function requireViewableApplication(
  user: CurrentUser,
  applicationId: number,
): Promise<ApplicationBrief> {
  const application = await prisma.applications.findUnique({ where: { id: applicationId } });
  if (!application || application.deleted_at) {
    throw httpError(404, 'Заявка не найдена', 'APPLICATION_NOT_FOUND');
  }
  if (user.role === RoleType.admin || application.owner_id === user.id) return application;
  if (user.role === RoleType.expert) {
    const assigned = await prisma.application_reviews.findFirst({
      where: { application_id: applicationId, expert_id: user.id, deleted_at: null },
      select: { id: true },
    });
    if (assigned) return application;
  }
  throw httpError(403, 'Нет доступа к файлам этой заявки', 'FORBIDDEN');
}

/** Проверяет принадлежность участника команды заявке. */
export async function requireTeamMemberOfApplication(applicationId: number, memberId: number): Promise<void> {
  const member = await prisma.team_members.findFirst({
    where: { id: memberId, application_id: applicationId, deleted_at: null },
    select: { id: true },
  });
  if (!member) throw httpError(404, 'Участник команды не найден', 'TEAM_MEMBER_NOT_FOUND');
}

/** Синхронизирует «легаси»-поле team_members.consent_file_path с последним согласием. */
export async function syncMemberConsentPath(memberId: number): Promise<void> {
  const latest = await prisma.consent_files.findFirst({
    where: { team_member_id: memberId, deleted_at: null },
    select: { file_path: true },
    orderBy: { id: 'desc' },
  });
  await prisma.team_members.update({
    where: { id: memberId },
    data: { consent_file_path: latest?.file_path ?? '' },
  });
}
