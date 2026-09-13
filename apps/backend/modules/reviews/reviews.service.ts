// Бизнес-логика рецензий: назначение экспертов администратором и оценка заявок.
import { RoleType } from '@arbuz/shared';
import { prisma } from '../../lib/prisma';
import { httpError } from '../../lib/http';
import { parseId } from '../../lib/parse';
import type { CurrentUser } from '../files/files.service';
import { getApplicationForAccess } from '../applications/applications.service';
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

  const existing = await prisma.application_reviews.findFirst({
    where: { application_id: application.id, expert_id: expertId, deleted_at: null },
    select: { id: true },
  });
  if (existing) throw httpError(409, 'Этот эксперт уже назначен на заявку', 'EXPERT_ALREADY_ASSIGNED');

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

  const review = await prisma.application_reviews.create({
    data: { application_id: application.id, expert_id: expertId, status_id: await getDefaultReviewStatusId() },
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
  patch: { status_id?: unknown; review_text?: unknown; rating?: unknown },
) {
  const review = await prisma.application_reviews.findUnique({
    where: { id: reviewId },
    include: { applications: { select: { id: true, tender_id: true } } },
  });
  if (!review || review.deleted_at) throw httpError(404, 'Рецензия не найдена', 'REVIEW_NOT_FOUND');
  if (user.role !== RoleType.admin && review.expert_id !== user.id) {
    throw httpError(403, 'Можно редактировать только свои рецензии', 'FORBIDDEN');
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
