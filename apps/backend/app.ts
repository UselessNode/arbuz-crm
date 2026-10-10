// Сборка Express-приложения без запуска сервера (нужно для автотестов).
import express from 'express';
import { prisma } from './lib/prisma';
import { errorHandler, notFoundHandler } from './lib/http';
import { authRouter } from './modules/auth/auth.routes';
import { consentsRouter } from './modules/consents/consents.routes';
import { documentsRouter } from './modules/documents/documents.routes';
import { notificationsRouter } from './modules/notifications/notifications.routes';
import { filesRouter } from './modules/files/files.routes';
import { postsRouter } from './modules/posts/posts.routes';
import { pdfExportRouter } from './modules/pdf-export/pdf-export.routes';
import { usersRouter } from './modules/users/users.routes';
import { applicationsRouter } from './modules/applications/applications.routes';
import { teamMembersRouter } from './modules/applications/team-members.routes';
import { projectPlansRouter } from './modules/applications/project-plans.routes';
import { projectBudgetRouter } from './modules/applications/project-budget.routes';
import { tendersRouter } from './modules/tenders/tenders.routes';
import { criteriaRouter } from './modules/tenders/criteria.routes';
import { directionsRouter } from './modules/directions/directions.routes';
import { statusesRouter } from './modules/statuses/statuses.routes';
import { sectionHintsRouter } from './modules/section-hints/section-hints.routes';
import { regionsRouter } from './modules/regions/regions.routes';
import { siteSettingsRouter } from './modules/site-settings/site-settings.routes';
import { reviewsRouter } from './modules/reviews/reviews.routes';
import { reviewsSummaryRouter } from './modules/reviews/summary.routes';
import { reviewStatusesRouter } from './modules/reviews/review-statuses.routes';
import packageJson from './package.json';

export const API_VERSION = packageJson.version;

export function createApp(): express.Express {
  const app = express();
  // Лимит тела запроса: публикации и тексты согласий могут быть крупными
  // (до 1 млн и 500 тыс. символов соответственно), поэтому выше дефолтных 100 КБ.
  app.use(express.json({ limit: '2mb' }));

  app.get('/', (_req, res) => {
    res.json({ name: 'Arbuz CRM API', status: 'running', version: API_VERSION });
  });

  app.get('/health', async (_req, res) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      res.json({ status: 'ok', database: 'connected' });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(503).json({ status: 'degraded', database: 'unavailable', message });
    }
  });

  app.use('/api/auth', authRouter);
  app.use('/api/consents', consentsRouter);
  app.use('/api/documents', documentsRouter);
  app.use('/api/notifications', notificationsRouter);
  app.use('/api/users', usersRouter);
  app.use('/api/applications', filesRouter);
  app.use('/api/applications', applicationsRouter);
  app.use('/api/applications', teamMembersRouter);
  app.use('/api/applications', projectPlansRouter);
  app.use('/api/applications', projectBudgetRouter);
  app.use('/api/posts', postsRouter);
  app.use('/api/tenders', tendersRouter);
  app.use('/api/tenders', criteriaRouter);
  app.use('/api/directions', directionsRouter);
  app.use('/api/application-statuses', statusesRouter);
  app.use('/api/review-statuses', reviewStatusesRouter);
  app.use('/api/application-section-hints', sectionHintsRouter);
  app.use('/api/regions', regionsRouter);
  app.use('/api/site-settings', siteSettingsRouter);
  // Сводка по экспертизам подключается раньше `reviewsRouter`: иначе
  // `/reviews/summary` перехватится его параметром `/:reviewId`.
  app.use('/api', reviewsSummaryRouter);
  app.use('/api', reviewsRouter);
  // pdf-export использует свои пути внутри /api/applications/:id/pdf-export и /api/pdf-export-jobs
  app.use('/api', pdfExportRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
