// HTTP API сводки по экспертизам (только admin): данные для режима с группировкой,
// страницы сводки и PDF-отчёта. Один источник — `summary.service`.
import { Router } from 'express';
import type { Request, Response } from 'express';
import { asyncHandler, httpError } from '../../lib/http';
import { parseId } from '../../lib/parse';
import { requireAuth } from '../auth/auth.middleware';
import type { CurrentUser } from '../files/files.service';
import { buildReviewSummary, type ReviewSelectionParams } from './summary.service';

export const reviewsSummaryRouter = Router();
reviewsSummaryRouter.use(requireAuth);

/**
 * `GET /api/reviews/summary?group=expert|verdict|score|date` — сводка для таблицы.
 * Группировка выполняется на клиенте (это преобразование строк), а критерии отбора —
 * поиск и фильтры — передаются здесь.
 */
reviewsSummaryRouter.get(
  '/reviews/summary',
  asyncHandler(async (req: Request, res: Response) => {
    const actor = req.user as CurrentUser;
    const params = parseSelectionQuery(req.query);
    const summary = await buildReviewSummary(actor, params);
    res.json({ summary });
  }),
);

/** Ровно один критерий отбора: expert_id | status_id | application_id | review_ids. */
export function parseSelectionQuery(query: Record<string, unknown>): ReviewSelectionParams {
  // Без критерия либо `all=1` — сводка по всей базе (допустимо только для админа,
  // проверку выполняет `buildReviewSummary`).
  if (query.all === '1' || query.all === 'true') return { all: true };
  const reviewIds = query.review_ids;
  if (typeof reviewIds === 'string' && reviewIds.trim()) {
    const ids = reviewIds
      .split(',')
      .map((raw) => parseId(raw, 'Некорректный идентификатор экспертизы'));
    if (ids.length === 0) throw httpError(400, 'Выберите хотя бы одну экспертизу', 'EMPTY_SELECTION');
    return { review_ids: ids };
  }
  if (typeof query.expert_id === 'string' && query.expert_id) return { expert_id: parseId(query.expert_id) };
  if (typeof query.status_id === 'string' && query.status_id) return { status_id: parseId(query.status_id) };
  if (typeof query.application_id === 'string' && query.application_id) {
    return { application_id: parseId(query.application_id) };
  }
  throw httpError(400, 'Укажите критерий отбора: expert_id, status_id, application_id, review_ids или all', 'EMPTY_SELECTION');
}
