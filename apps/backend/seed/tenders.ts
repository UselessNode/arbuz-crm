// Конкурс seed: сам конкурс, его критерии оценивания и направления.
import { prisma } from '../lib/prisma';
import { log } from '../lib/logger';
import type { SeedTender } from './data';

/** Создаёт конкурс с критериями и направлениями, если их ещё нет (идемпотентно). */
export async function ensureTender(input: SeedTender) {
  let tender = await prisma.tenders.findFirst({ where: { name: input.name, deleted_at: null } });
  if (!tender) {
    tender = await prisma.tenders.create({
      data: { name: input.name, description: input.description, experts_count: input.expertsCount },
    });
    log.info('seed: создан конкурс', { id: tender.id, name: tender.name });
  }

  for (const criterion of input.criteria) {
    const exists = await prisma.evaluation_criteria.findFirst({
      where: { tender_id: tender.id, name: criterion.name, deleted_at: null },
      select: { id: true },
    });
    if (exists) continue;
    await prisma.evaluation_criteria.create({
      data: {
        tender_id: tender.id,
        name: criterion.name,
        description: criterion.description,
        min_value: criterion.min,
        max_value: criterion.max,
        weight: criterion.weight,
      },
    });
  }

  const directions = [];
  for (const direction of input.directions) {
    let row = await prisma.directions.findFirst({
      where: { tender_id: tender.id, name: direction.name, deleted_at: null },
    });
    if (!row) {
      row = await prisma.directions.create({
        data: { tender_id: tender.id, name: direction.name, description: direction.description },
      });
    }
    directions.push(row);
  }

  log.info('seed: конкурс готов', {
    id: tender.id,
    criteria: input.criteria.length,
    directions: directions.length,
    expertsCount: input.expertsCount,
  });
  return { tender, directions };
}
