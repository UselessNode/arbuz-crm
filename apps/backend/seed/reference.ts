// Справочники seed: статусы заявок и вердикты экспертиз.
import { prisma } from '../lib/prisma';
import { log } from '../lib/logger';
import { APPLICATION_STATUS_SEED, REVIEW_STATUS_SEED, type ApplicationStatusKey } from './data';

export type StatusMap = Record<ApplicationStatusKey, number>;

/** Создаёт базовые статусы (если справочник пуст) и возвращает их id по ключу. */
export async function ensureApplicationStatuses(): Promise<StatusMap> {
  const existing = await prisma.application_statuses.findFirst({ select: { id: true } });
  if (!existing) {
    await prisma.application_statuses.createMany({
      data: APPLICATION_STATUS_SEED.map(({ key: _key, ...row }) => row),
    });
    log.info('seed: созданы статусы заявок');
  }

  const rows = await prisma.application_statuses.findMany({ where: { deleted_at: null }, select: { id: true, name: true } });
  const byName = (name: string): number => {
    const status = rows.find((row) => row.name === name);
    if (!status) throw new Error(`[seed] Статус «${name}» не найден в справочнике`);
    return status.id;
  };
  return APPLICATION_STATUS_SEED.reduce<StatusMap>(
    (acc, { key, name }) => ({ ...acc, [key]: byName(name) }),
    {} as StatusMap,
  );
}

/** Создаёт базовые вердикты (если справочник пуст) и возвращает функцию «название → id». */
export async function ensureReviewStatuses(): Promise<(name: string) => number> {
  const existing = await prisma.review_statuses.findFirst({ select: { id: true } });
  if (!existing) {
    await prisma.review_statuses.createMany({ data: REVIEW_STATUS_SEED.map((row) => ({ ...row })) });
    log.info('seed: созданы вердикты экспертиз');
  }

  const rows = await prisma.review_statuses.findMany({ where: { deleted_at: null }, select: { id: true, name: true } });
  return (name: string) => {
    const status = rows.find((row) => row.name === name);
    if (!status) throw new Error(`[seed] Вердикт «${name}» не найден в справочнике`);
    return status.id;
  };
}
