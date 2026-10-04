// Экспертизы seed: назначение эксперта и выставленный вердикт.
import { prisma } from '../lib/prisma';

export interface ReviewSeed {
  statusId: number;
  text?: string;
  /** Итоговый балл (демонстрация средних значений в списке/сводке). */
  totalScore?: number;
}

/** Назначает эксперта на заявку, если экспертизы ещё нет. */
export async function ensureReview(applicationId: number, expertId: number, seed: ReviewSeed): Promise<void> {
  const existing = await prisma.application_reviews.findFirst({
    where: { application_id: applicationId, expert_id: expertId },
    select: { id: true, total_score: true },
  });
  if (existing) {
    // Бэкфилл: у ранее созданных seed-экспертиз балла не было — проставляем один раз.
    if (seed.totalScore !== undefined && existing.total_score === null) {
      await prisma.application_reviews.update({
        where: { id: existing.id },
        data: { total_score: seed.totalScore },
      });
    }
    return;
  }
  await prisma.application_reviews.create({
    data: {
      application_id: applicationId,
      expert_id: expertId,
      status_id: seed.statusId,
      review_text: seed.text ?? null,
      total_score: seed.totalScore ?? null,
    },
  });
}
