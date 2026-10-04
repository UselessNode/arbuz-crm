// Бизнес-логика экспертиз: назначение экспертов администратором и оценка заявок.
import { Prisma } from '@arbuz/shared';
import { NotificationType, RoleType } from '@arbuz/shared';
import { prisma } from '../../lib/prisma';
import { httpError } from '../../lib/http';
import type { DateRangeFilter, NumberRangeFilter, SortSpec } from '../../lib/query';
import { parseId } from '../../lib/parse';
import type { CurrentUser } from '../files/files.service';
import { getApplicationForAccess } from '../applications/applications.service';
import { createNotification } from '../notifications/notifications.service';
import { getDefaultReviewStatusId } from './review-statuses.service';

/** Сколько экспертов назначается на заявку, если у конкурса не задано иное. */
const DEFAULT_EXPERTS_COUNT = 2;

/** Согласование слова «эксперт» с числом (1 — эксперт, 2 — эксперта, 5 — экспертов). */
function expertsWord(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return 'эксперт';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'эксперта';
  return 'экспертов';
}

export { parseId } from '../../lib/parse';

interface ReviewStatusRef {
  id: number;
  name: string;
  tone: string;
}

function optionalText(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text.length ? text : null;
}

function serializeReview(review: {
  id: number;
  application_id: number;
  review_text: string | null;
  rating: unknown;
  total_score: number | null;
  updated_at: Date;
  applications?: { id: number; title: string } | null;
  users?: { id: number; email: string; name: string | null; surname: string | null; patronymic: string | null } | null;
  review_statuses?: ReviewStatusRef | null;
}) {
  return {
    id: review.id,
    applicationId: review.application_id,
    applicationTitle: review.applications?.title ?? null,
    expert: review.users
      ? {
          id: review.users.id,
          email: review.users.email,
          name: review.users.name,
          surname: review.users.surname,
          patronymic: review.users.patronymic,
        }
      : null,
    status: review.review_statuses
      ? { id: review.review_statuses.id, name: review.review_statuses.name, tone: review.review_statuses.tone }
      : null,
    text: review.review_text,
    rating: review.rating,
    totalScore: review.total_score,
    updatedAt: review.updated_at,
  };
}

const reviewInclude = {
  applications: { select: { id: true, title: true } },
  users: { select: { id: true, email: true, name: true, surname: true, patronymic: true } },
  review_statuses: { select: { id: true, name: true, tone: true } },
} as const;

/** Ограничение конкурса: сколько экспертов можно назначить на одну заявку. */
export async function expertsLimitForTender(tenderId: number | null): Promise<number> {
  if (!tenderId) return DEFAULT_EXPERTS_COUNT;
  const tender = await prisma.tenders.findUnique({
    where: { id: tenderId },
    select: { experts_count: true },
  });
  return tender?.experts_count ?? DEFAULT_EXPERTS_COUNT;
}

/** Назначение эксперта на заявку (создаёт рецензию с вердиктом по умолчанию). Только администратор. */
export async function assignExpert(actor: CurrentUser, applicationId: number, rawExpertId: unknown) {
  if (actor.role !== RoleType.admin) throw httpError(403, 'Действие доступно только администратору', 'FORBIDDEN');
  const application = await getApplicationForAccess(actor, applicationId, 'view');

  const expertId = parseId(rawExpertId, 'Некорректный идентификатор эксперта');
  const expert = await prisma.users.findFirst({
    where: { id: expertId, role: RoleType.expert, deleted_at: null },
    select: { id: true },
  });
  if (!expert) throw httpError(404, 'Эксперт не найден', 'EXPERT_NOT_FOUND');

  // Уникальный индекс (application_id, expert_id) не учитывает soft-delete, поэтому
  // удалённая экспертиза всё ещё занимает строку: ищем любое состояние и при soft-delete
  // восстанавливаем запись вместо создания — иначе Prisma упадёт на нарушении уникальности.
  const existing = await prisma.application_reviews.findUnique({
    where: { application_id_expert_id: { application_id: application.id, expert_id: expertId } },
    select: { id: true, deleted_at: true },
  });
  if (existing && !existing.deleted_at) {
    throw httpError(409, 'Этот эксперт уже назначен на заявку', 'EXPERT_ALREADY_ASSIGNED');
  }

  // Не больше, чем задано в настройках конкурса (см. «Настройки конкурсов и направлений»).
  const limit = await expertsLimitForTender(application.tender_id);
  const assigned = await prisma.application_reviews.count({
    where: { application_id: application.id, deleted_at: null },
  });
  if (assigned >= limit) {
    throw httpError(
      409,
      `По условиям конкурса на заявку назначается не более ${limit} ${expertsWord(limit)}. Снимите лишнего эксперта.`,
      'EXPERT_LIMIT_REACHED',
    );
  }

  const statusId = await getDefaultReviewStatusId();
  const review = existing
    ? await prisma.application_reviews.update({
        where: { id: existing.id },
        data: { deleted_at: null, status_id: statusId, review_text: null, rating: Prisma.DbNull, total_score: null },
        include: reviewInclude,
      })
    : await prisma.application_reviews.create({
        data: { application_id: application.id, expert_id: expertId, status_id: statusId },
        include: reviewInclude,
      });
  // Уведомляем эксперта о назначении.
  await createNotification(expertId, {
    type: NotificationType.expert_assignment,
    title: 'Вы назначены экспертом',
    body: `Заявка «${application.title}» назначена вам на экспертизу.`,
    link: `/expert/applications/${application.id}`,
  });
  return serializeReview(review);
}

export interface ReviewsFilter {
  search?: string;
  /** Мультивыбор вердиктов (review_statuses). */
  statusIds?: number[];
  /** Мультивыбор экспертов. */
  expertIds?: number[];
  /** Мультивыбор заявок. */
  applicationIds?: number[];
  /** Диапазон итогового балла. */
  score?: NumberRangeFilter;
  created?: DateRangeFilter;
  updated?: DateRangeFilter;
  sort?: SortSpec | null;
  /** null — без пагинации (обратная совместимость). */
  limit: number | null;
  offset: number;
}

function reviewsOrderBy(sort: SortSpec | null | undefined): Prisma.application_reviewsOrderByWithRelationInput[] {
  if (!sort) return [{ id: 'desc' }];
  const direction = sort.direction;
  switch (sort.field) {
    case 'created_at':
      return [{ created_at: direction }];
    case 'updated_at':
      return [{ updated_at: direction }];
    case 'total_score':
      return [{ total_score: direction }];
    default:
      return [{ id: 'desc' }];
  }
}

export async function listReviews(user: CurrentUser, filter: ReviewsFilter) {
  const accessWhere: Prisma.application_reviewsWhereInput =
    user.role === RoleType.admin
      ? {}
      : user.role === RoleType.expert
        ? { expert_id: user.id }
        : { applications: { owner_id: user.id } };

  const where: Prisma.application_reviewsWhereInput = {
    deleted_at: null,
    ...accessWhere,
    ...(filter.statusIds?.length ? { status_id: { in: filter.statusIds } } : {}),
    ...(filter.expertIds?.length ? { expert_id: { in: filter.expertIds } } : {}),
    ...(filter.applicationIds?.length ? { application_id: { in: filter.applicationIds } } : {}),
    ...(filter.score
      ? {
          total_score: {
            ...(filter.score.min !== undefined ? { gte: filter.score.min } : {}),
            ...(filter.score.max !== undefined ? { lte: filter.score.max } : {}),
          },
        }
      : {}),
    ...(filter.created ? { created_at: filter.created } : {}),
    ...(filter.updated ? { updated_at: filter.updated } : {}),
    ...(filter.search
      ? {
          OR: [
            { applications: { title: { contains: filter.search, mode: 'insensitive' } } },
            {
              users: {
                OR: [
                  { surname: { contains: filter.search, mode: 'insensitive' } },
                  { name: { contains: filter.search, mode: 'insensitive' } },
                  { patronymic: { contains: filter.search, mode: 'insensitive' } },
                  { email: { contains: filter.search, mode: 'insensitive' } },
                ],
              },
            },
          ],
        }
      : {}),
  };

  const [reviews, total] = await Promise.all([
    prisma.application_reviews.findMany({
      where,
      orderBy: reviewsOrderBy(filter.sort),
      ...(filter.limit !== null ? { skip: filter.offset, take: filter.limit } : {}),
      include: reviewInclude,
    }),
    prisma.application_reviews.count({ where }),
  ]);
  return { reviews: reviews.map(serializeReview), total };
}

/** Оценка заявки экспертом (или правка администратором). */
export async function updateReview(
  user: CurrentUser,
  reviewId: number,
  patch: { status_id?: unknown; review_text?: unknown; rating?: unknown },
) {
  const review = await prisma.application_reviews.findUnique({
    where: { id: reviewId },
    include: { applications: { select: { id: true, tender_id: true } } },
  });
  if (!review || review.deleted_at) throw httpError(404, 'Экспертиза не найдена', 'REVIEW_NOT_FOUND');
  if (user.role !== RoleType.admin && review.expert_id !== user.id) {
    throw httpError(403, 'Можно редактировать только свои экспертизы', 'FORBIDDEN');
  }

  const data: { status_id?: number; review_text?: string | null; rating?: object; total_score?: number } = {};
  if (patch.status_id !== undefined) {
    const statusId = parseId(patch.status_id, 'Некорректный вердикт');
    const status = await prisma.review_statuses.findFirst({
      where: { id: statusId, deleted_at: null },
      select: { id: true },
    });
    if (!status) throw httpError(400, 'Вердикт не найден', 'REVIEW_STATUS_NOT_FOUND');
    data.status_id = statusId;
  }
  if (patch.review_text !== undefined) data.review_text = optionalText(patch.review_text);
  if (patch.rating !== undefined) {
    const { rating, totalScore } = await validateAndScore(review.applications.tender_id, patch.rating);
    data.rating = rating;
    data.total_score = totalScore;
  }

  const updated = await prisma.application_reviews.update({ where: { id: reviewId }, data, include: reviewInclude });
  return serializeReview(updated);
}

/** Снятие эксперта (удаление рецензии). Только администратор. */
export async function deleteReview(actor: CurrentUser, reviewId: number): Promise<void> {
  if (actor.role !== RoleType.admin) throw httpError(403, 'Действие доступно только администратору', 'FORBIDDEN');
  const review = await prisma.application_reviews.findFirst({
    where: { id: reviewId, deleted_at: null },
    select: { id: true, expert_id: true, applications: { select: { id: true, title: true } } },
  });
  if (!review) throw httpError(404, 'Экспертиза не найдена', 'REVIEW_NOT_FOUND');
  await prisma.application_reviews.update({ where: { id: reviewId }, data: { deleted_at: new Date() } });
  // Уведомляем эксперта о снятии с заявки.
  await createNotification(review.expert_id, {
    type: NotificationType.expert_assignment,
    title: 'Вы сняты с экспертизы',
    body: `Заявка «${review.applications?.title ?? '—'}» больше не назначена вам.`,
    link: '/expert',
  });
}

/**
 * Проверяет оценки по критериям конкурса и считает итоговый балл (сумма value * weight).
 * Значения должны попадать в диапазон min_value..max_value критерия.
 */
async function validateAndScore(
  tenderId: number | null,
  rawRating: unknown,
): Promise<{ rating: Record<string, number>; totalScore: number }> {
  if (!tenderId) {
    throw httpError(400, 'У заявки не задан конкурс — оценка по критериям невозможна', 'TENDER_REQUIRED');
  }
  if (!rawRating || typeof rawRating !== 'object' || Array.isArray(rawRating)) {
    throw httpError(400, 'Оценка должна быть объектом { criterionId: value }', 'INVALID_RATING');
  }

  const criteria = await prisma.evaluation_criteria.findMany({
    where: { tender_id: tenderId, deleted_at: null },
    select: { id: true, name: true, min_value: true, max_value: true, weight: true },
  });
  const byId = new Map(criteria.map((c) => [c.id, c]));

  const rating: Record<string, number> = {};
  let totalScore = 0;
  for (const [key, value] of Object.entries(rawRating)) {
    const criterion = byId.get(Number(key));
    if (!criterion) {
      throw httpError(400, `Критерий ${key} не относится к конкурсу заявки`, 'INVALID_CRITERION');
    }
    const score = Number(value);
    if (!Number.isFinite(score) || score < criterion.min_value || score > criterion.max_value) {
      throw httpError(
        400,
        `Оценка по критерию «${criterion.name}» должна быть в диапазоне ${criterion.min_value}..${criterion.max_value}`,
        'INVALID_RATING',
      );
    }
    rating[key] = score;
    totalScore += score * criterion.weight;
  }
  return { rating, totalScore };
}
