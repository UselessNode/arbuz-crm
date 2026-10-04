// Смоук: документ, назначенный шаблоном согласия ПДн, отдаётся вместо комплектного образца.
//
// Проверяем приоритет документа в `getConsentTemplate` для вида `adult` и возврат к
// комплектному образцу после снятия привязки. Исходное состояние БД восстанавливаем.
import { prisma } from '../../lib/prisma';
import { getConsentTemplate } from '../../modules/consents/consents.service';
import { updateDocument } from '../../modules/documents/documents.service';
import { createSmoke } from '../helpers/smoke';
import { requireAdmin } from '../helpers/actors';

const smoke = createSmoke('documents-template (документ как шаблон ПДн)');
const KIND = 'adult';

async function main(): Promise<void> {
  const admin = await requireAdmin();

  const document = await prisma.documents.findFirst({
    where: { deleted_at: null, file: { deleted_at: null } },
    select: { id: true, title: true, file: { select: { file_type: true } } },
    orderBy: { id: 'asc' },
  });
  if (!document) {
    smoke.ok('в dev-базе есть документ для проверки', false, 'выполните `bun seed`');
    smoke.done();
    return;
  }

  const original = await prisma.documents.findFirst({
    where: { consent_template_kind: KIND, deleted_at: null },
    select: { id: true },
  });
  const originalId = original?.id ?? null;
  const expectedType = document.file.file_type ?? 'pdf';

  try {
    await updateDocument(admin, document.id, { consent_template_kind: KIND });
    const assigned = await getConsentTemplate(KIND);
    smoke.ok(
      'назначенный документ отдаётся как шаблон',
      assigned.downloadName.startsWith(document.title),
      { downloadName: assigned.downloadName, title: document.title },
    );
    smoke.eq('тип файла шаблона — из документа', assigned.fileType, expectedType);

    await updateDocument(admin, document.id, { consent_template_kind: null });
    const fallback = await getConsentTemplate(KIND);
    smoke.ok('после снятия привязки — комплектный образец', fallback.downloadName.includes('Согласие'), fallback.downloadName);
  } finally {
    // Восстанавливаем исходную привязку (если она была).
    if (originalId === document.id) {
      await updateDocument(admin, document.id, { consent_template_kind: KIND });
    } else {
      await updateDocument(admin, document.id, { consent_template_kind: null });
      if (originalId !== null) await updateDocument(admin, originalId, { consent_template_kind: KIND });
    }
  }

  smoke.done();
}

main();
