// Смоук: публичные документы — видимость, порядок, правка, снятие с публикации, удаление.
import { prisma } from '../../lib/prisma';
import {
  deleteDocument,
  listManagedDocuments,
  listPublicDocuments,
  updateDocument,
} from '../../modules/documents/documents.service';
import { createSmoke } from '../helpers/smoke';
import { asExpert, requireAdmin } from '../helpers/actors';

const smoke = createSmoke('documents (публичные документы)');

async function main(): Promise<void> {
  const admin = await requireAdmin();
  let fileId: number | null = null;
  let documentId: number | null = null;

  try {
    // Создаём запись напрямую: загрузка файла требует multipart-запроса,
    // а здесь проверяется бизнес-логика списка/правки/удаления.
    const file = await prisma.files.create({
      data: { name: `[smoke] документ ${Date.now()}`, file_type: 'pdf', path: 'uploads/documents/smoke-placeholder.pdf' },
      select: { id: true },
    });
    fileId = file.id;
    const document = await prisma.documents.create({
      data: { title: `[smoke] Документ ${Date.now()}`, file_id: file.id, sort_order: 5, is_published: true },
      select: { id: true },
    });
    documentId = document.id;

    const publicList = await listPublicDocuments();
    smoke.ok('публичный список содержит опубликованный документ', publicList.some((item) => item.id === document.id));

    // Правка метаданных.
    const updated = await updateDocument(admin, document.id, { title: '[smoke] Обновлённый документ', sort_order: 1 });
    smoke.eq('правка: заголовок изменён', updated.title, '[smoke] Обновлённый документ');
    smoke.eq('правка: порядок изменён', updated.sortOrder, 1);

    // Снятие с публикации: исчезает из публичного списка, остаётся в админском.
    await updateDocument(admin, document.id, { is_published: false });
    smoke.ok('скрытый документ не отдаётся публично', !(await listPublicDocuments()).some((item) => item.id === document.id));
    smoke.ok('скрытый документ виден администратору', (await listManagedDocuments(admin)).some((item) => item.id === document.id));

    // Права: не-админ не может управлять документами.
    await smoke.fails(
      'эксперт не может читать список для админки',
      () => listManagedDocuments(asExpert(admin.id, admin.email)),
      'FORBIDDEN',
    );
    await smoke.fails(
      'эксперт не может удалять документы',
      () => deleteDocument(asExpert(admin.id, admin.email), document.id),
      'FORBIDDEN',
    );

    // Удаление: пропадает и из админского списка.
    await deleteDocument(admin, document.id);
    smoke.ok('удалённый документ не виден администратору', !(await listManagedDocuments(admin)).some((item) => item.id === document.id));
    documentId = null;
  } finally {
    if (documentId !== null) await prisma.documents.delete({ where: { id: documentId } });
    if (fileId !== null) await prisma.files.delete({ where: { id: fileId } });
    await prisma.$disconnect();
  }

  smoke.done();
}

await main();
