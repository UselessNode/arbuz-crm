// Общие HTTP-помощники: ошибка с кодом, обёртка async-роутов, обработчики 404/ошибок.
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { log } from './logger';

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code = 'HTTP_ERROR',
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export function httpError(status: number, message: string, code = 'HTTP_ERROR'): HttpError {
  return new HttpError(status, message, code);
}

export const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
  (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    error: { code: 'NOT_FOUND', message: `Маршрут ${req.method} ${req.path} не найден` },
  });
}

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: { code: err.code, message: err.message } });
    return;
  }
  log.error('Необработанная ошибка', { path: req.path, error: String(err) });
  res.status(500).json({ error: { code: 'INTERNAL', message: 'Внутренняя ошибка сервера' } });
}
