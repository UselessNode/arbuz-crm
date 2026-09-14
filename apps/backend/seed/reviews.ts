// Экспертизы seed: назначение эксперта и выставленный вердикт.
import { prisma } from '../lib/prisma';

export interface ReviewSeed {
  statusId: number;
  text?: string;
}

/** Назначает эксперта на заявку, если экспертизы ещё нет. */
export async function ensureReview(applicationId: number, expertId: number, seed: ReviewSeed): Promise<void> {
  const existing = await prisma.application_reviews.findFirst({
    where: { application_id: applicationId, expert_id: expertId },
    select: { id: true },
  });
  if (existing) return;
  await prisma.application_reviews.create({
    data: {
      application_id: applicationId,
      expert_id: expertId,
      status_id: seed.statusId,
      review_text: seed.text ?? null,
    },
  });
}
