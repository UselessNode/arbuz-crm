// Бизнес-логика рецензий: назначение экспертов администратором и оценка заявок.
import { RoleType, ReviewStatus } from '@arbuz/shared';
import { prisma } from '../../lib/prisma';
import { httpError } from '../../lib/http';
import type { CurrentUser } from '../files/files.service';
import { getApplicationForAccess } from '../applications/applications.service';

const REVIEW_STATUSES: readonly ReviewStatus[] = [ReviewStatus.draft, ReviewStatus.approved, ReviewStatus.rejected];

export function parseId(raw: string | undefined): number {
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) {
    throw httpError(400, 'Некорректный идентификатор', 'INVALID_ID');
  }
  return value;
}

function parseReviewStatus(value: unknown): ReviewStatus {
  if (typeof value !== 'string' || !(REVIEW_STATUSES as readonly string[]).includes(value)) {
    throw httpError(400, 'Недопустимый статус рецензии', 'INVALID_REVIEW_STATUS');
  }
  return value as ReviewStatus;
}

function optionalText(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text.length ? text : null;
}

function serializeReview(review: {
  id: number;
  application_id: number;
  review_status: ReviewStatus | null;
  review_text: string | null;
  rating: unknown;
  total_score: number | null;
  updated_at: Date;
  applications?: { id: number; title: string } | null;
  users?: { id: number; email: string; name: string | null; surname: string | null; patronymic: string | null } | null;
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
    status: review.review_status,
    text: review.review_text,
    rating: review.rating,
    totalScore: review.total_score,
    updatedAt: review.updated_at,
  };
}

const reviewInclude = {
  applications: { select: { id: true, title: true } },
  users: { select: { id: true, email: true, name: true, surname: true, patronymic: true } },
} as const;

/** Назначение эксперта на заявку (создаёт рецензию в статусе draft). Только администратор. */
export async function assignExpert(actor: CurrentUser, applicationId: number, rawExpertId: unknown) {
  if (actor.role !== RoleType.admin) throw httpError(403, 'Действие доступно только администратору', 'FORBIDDEN');
  const application = await getApplicationForAccess(actor, applicationId, 'view');

  const expertId = parseId(String(rawExpertId ?? ''));
  const expert = await prisma.users.findFirst({
    where: { id: expertId, role: RoleType.expert, deleted_at: null },
    select: { id: true },
  });
  if (!expert) throw httpError(404, 'Эксперт не найден', 'EXPERT_NOT_FOUND');

  const existing = await prisma.application_reviews.findFirst({
    where: { application_id: application.id, expert_id: expertId, deleted_at: null },
    select: { id: true },
  });
  if (existing) throw httpError(409, 'Этот эксперт уже назначен на заявку', 'EXPERT_ALREADY_ASSIGNED');

  const review = await prisma.application_reviews.create({
    data: { application_id: application.id, expert_id: expertId, review_status: ReviewStatus.draft },
    include: reviewInclude,
  });
  return serializeReview(review);
}

export async function listReviews(user: CurrentUser) {
  const where =
    user.role === RoleType.admin
      ? { deleted_at: null }
      : user.role === RoleType.expert
        ? { deleted_at: null, expert_id: user.id }
        : { deleted_at: null, applications: { owner_id: user.id } };

  const reviews = await prisma.application_reviews.findMany({
    where,
    orderBy: { id: 'desc' },
    include: reviewInclude,
  });
  return reviews.map(serializeReview);
}

/** Оценка заявки экспертом (или правка администратором). */
export async function updateReview(
  user: CurrentUser,
  reviewId: number,
  patch: { review_status?: unknown; review_text?: unknown; rating?: unknown },
) {
  const review = await prisma.application_reviews.findUnique({
    where: { id: reviewId },
    include: { applications: { select: { id: true, tender_id: true } } },
  });
  if (!review || review.deleted_at) throw httpError(404, 'Рецензия не найдена', 'REVIEW_NOT_FOUND');
  if (user.role !== RoleType.admin && review.expert_id !== user.id) {
    throw httpError(403, 'Можно редактировать только свои рецензии', 'FORBIDDEN');
  }

  const data: { review_status?: ReviewStatus; review_text?: string | null; rating?: object; total_score?: number } = {};
  if (patch.review_status !== undefined) data.review_status = parseReviewStatus(patch.review_status);
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
  const review = await prisma.application_reviews.findFirst({ where: { id: reviewId, deleted_at: null }, select: { id: true } });
  if (!review) throw httpError(404, 'Рецензия не найдена', 'REVIEW_NOT_FOUND');
  await prisma.application_reviews.update({ where: { id: reviewId }, data: { deleted_at: new Date() } });
}

/**
 * Проверяет оценки по критериям тендера и считает итоговый балл (сумма value * weight).
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
