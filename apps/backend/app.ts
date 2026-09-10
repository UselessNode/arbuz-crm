// Сборка Express-приложения без запуска сервера (нужно для автотестов).
import express from 'express';
import { prisma } from './lib/prisma';
import { errorHandler, notFoundHandler } from './lib/http';
import { authRouter } from './modules/auth/auth.routes';
import { filesRouter } from './modules/files/files.routes';
import { postsRouter } from './modules/posts/posts.routes';
import { pdfExportRouter } from './modules/pdf-export/pdf-export.routes';
import { usersRouter } from './modules/users/users.routes';
import { applicationsRouter } from './modules/applications/applications.routes';
import { teamMembersRouter } from './modules/applications/team-members.routes';
import { projectPlansRouter } from './modules/applications/project-plans.routes';
import { projectBudgetRouter } from './modules/applications/project-budget.routes';

export const API_VERSION = '1.3.0';

export function createApp(): express.Express {
  const app = express();
  app.use(express.json());

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
  app.use('/api/users', usersRouter);
  app.use('/api/applications', filesRouter);
  app.use('/api/applications', applicationsRouter);
  app.use('/api/applications', teamMembersRouter);
  app.use('/api/applications', projectPlansRouter);
  app.use('/api/applications', projectBudgetRouter);
  app.use('/api/posts', postsRouter);
  // pdf-export использует свои пути внутри /api/applications/:id/pdf-export и /api/pdf-export-jobs
  app.use('/api', pdfExportRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
