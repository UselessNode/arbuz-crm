// HTTP API пользовательских соглашений.
// Публично: текущие редакции документов (нужны странице регистрации) и скачивание образцов ПДн.
// Только администратору: история редакций и публикация новой.
import { createReadStream } from 'node:fs';
import { Router } from 'express';
import type { Request, Response } from 'express';
import { asyncHandler } from '../../lib/http';
import { log } from '../../lib/logger';
import { oneOf } from '../../lib/parse';
import { optionalAuth, requireAuth } from '../auth/auth.middleware';
import { applyDownloadHeaders } from '../files/download';
import type { CurrentUser } from '../files/files.service';
import {
  CONSENT_DOCUMENT_TYPES,
  getConsentTemplate,
  getCurrentConsentDocument,
  isConsentTemplateKind,
  listConsentDocuments,
  publishConsentDocument,
} from './consents.service';

export const consentsRouter = Router();
consentsRouter.use(optionalAuth);

// Текущая редакция документа — публично (страница регистрации до аутентификации).
consentsRouter.get(
  '/documents/current',
  asyncHandler(async (req: Request, res: Response) => {
    const type = oneOf(req.query.type, CONSENT_DOCUMENT_TYPES, 'Тип документа');
    const document = await getCurrentConsentDocument(type);
    res.json({ document });
  }),
);

// История редакций — только администратор.
consentsRouter.get(
  '/documents',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const actor = req.user as CurrentUser;
    const type = req.query.type ? oneOf(req.query.type, CONSENT_DOCUMENT_TYPES, 'Тип документа') : undefined;
    const documents = await listConsentDocuments(actor, type);
    res.json({ documents });
  }),
);

// Публикация новой редакции — только администратор (старые не изменяются).
consentsRouter.post(
  '/documents',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const actor = req.user as CurrentUser;
    const document = await publishConsentDocument(actor, {
      document_type: req.body?.document_type,
      version: req.body?.version,
      text: req.body?.text,
    });
    log.audit('consents.publish', {
      userId: actor.id,
      type: document.type,
      version: document.version,
      hash: document.hash,
    });
    res.status(201).json({ document });
  }),
);

// Скачивание образца согласия ПДн (docx в приоритете, иначе pdf). Публично —
// это открытые типовые формы, нужны и на форме заявки, и в публичном разделе «Документы».
consentsRouter.get(
  '/templates/:kind/download',
  asyncHandler(async (req: Request, res: Response) => {
    if (!isConsentTemplateKind(req.params.kind)) {
      res.status(404).json({ error: { code: 'TEMPLATE_NOT_FOUND', message: 'Шаблон согласия не найден' } });
      return;
    }
    const template = await getConsentTemplate(req.params.kind);
    applyDownloadHeaders(res, template.downloadName, template.fileType, template.size);
    const stream = createReadStream(template.absolutePath);
    stream.on('error', () => res.destroy());
    res.on('close', () => stream.destroy());
    stream.pipe(res);
  }),
);
