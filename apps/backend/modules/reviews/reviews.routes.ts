// HTTP API рецензий: назначение экспертов (admin) и оценка (expert/admin).
import { Router } from 'express';
import type { Request, Response } from 'express';
import { asyncHandler } from '../../lib/http';
import { log } from '../../lib/logger';
import { parseId } from '../../lib/parse';
import {
  parseDateRange,
  parseIdArray,
  parseNumberRange,
  parseOptionalLimitOffset,
  parseSearch,
  parseSort,
} from '../../lib/query';
import { requireAuth } from '../auth/auth.middleware';
import type { CurrentUser } from '../files/files.service';
import { assignExpert, deleteReview, listReviews, updateReview } from './reviews.service';

export const reviewsRouter = Router();
reviewsRouter.use(requireAuth);

const REVIEW_SORT_FIELDS = ['created_at', 'updated_at', 'total_score'] as const;

reviewsRouter.get(
  '/reviews',
  asyncHandler(async (req: Request, res: Response) => {
    // Пагинация включается только при явном `limit` (иначе — весь список, как раньше).
    const { limit, offset } = parseOptionalLimitOffset(req.query);
    const result = await listReviews(req.user as CurrentUser, {
      search: parseSearch(req.query),
      statusIds: parseIdArray(req.query.status_ids),
      expertIds: parseIdArray(req.query.expert_ids),
      applicationIds: parseIdArray(req.query.application_ids),
      score: parseNumberRange(req.query, 'score'),
      created: parseDateRange(req.query, 'created'),
      updated: parseDateRange(req.query, 'updated'),
      sort: parseSort(req.query, REVIEW_SORT_FIELDS),
      limit,
      offset,
    });
    res.json(result);
  }),
);

reviewsRouter.post(
  '/applications/:applicationId/reviews',
  asyncHandler(async (req: Request, res: Response) => {
    const actor = req.user as CurrentUser;
    const applicationId = parseId(req.params.applicationId);
    const review = await assignExpert(actor, applicationId, req.body?.expert_id);
    log.audit('reviews.assign', { userId: actor.id, applicationId, reviewId: review.id, expertId: review.expert?.id });
    res.status(201).json({ review });
  }),
);

reviewsRouter.patch(
  '/reviews/:reviewId',
  asyncHandler(async (req: Request, res: Response) => {
    const actor = req.user as CurrentUser;
    const reviewId = parseId(req.params.reviewId);
    const review = await updateReview(actor, reviewId, {
      status_id: req.body?.status_id,
      review_text: req.body?.review_text,
      rating: req.body?.rating,
    });
    log.audit('reviews.update', { userId: actor.id, reviewId: review.id, status: review.status?.name });
    res.json({ review });
  }),
);

reviewsRouter.delete(
  '/reviews/:reviewId',
  asyncHandler(async (req: Request, res: Response) => {
    const actor = req.user as CurrentUser;
    const reviewId = parseId(req.params.reviewId);
    await deleteReview(actor, reviewId);
    log.audit('reviews.delete', { userId: actor.id, reviewId });
    res.json({ ok: true });
  }),
);
