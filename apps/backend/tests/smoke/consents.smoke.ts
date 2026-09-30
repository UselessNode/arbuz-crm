// Смоук: пользовательские соглашения (ПС) — редакции документов, журнал принятия,
// обязательность согласий при регистрации и разрешение образцов ПДн (шаблонов).
import { ConsentDocumentType } from '@arbuz/shared';
import { prisma } from '../../lib/prisma';
import { registerApplicant } from '../../modules/auth/auth.service';
import {
  buildConsentEvents,
  getConsentTemplate,
  getCurrentConsentDocument,
  hashConsentText,
  listConsentDocuments,
  publishConsentDocument,
  requireRegistrationConsents,
} from '../../modules/consents/consents.service';
import { createSmoke } from '../helpers/smoke';
import { asExpert, requireAdmin } from '../helpers/actors';

const smoke = createSmoke('consents (пользовательские соглашения)');

const META = { ip: '203.0.113.7', userAgent: 'smoke-test/1.0' };

async function main(): Promise<void> {
  const admin = await requireAdmin();
  const testEmail = `smoke-consent-${Date.now()}@arbuz.local`;
  let userId: number | null = null;
  let publishedId: number | null = null;

  try {
    // Текущие редакции документов существуют и их хэш совпадает с текстом.
    const terms = await getCurrentConsentDocument(ConsentDocumentType.terms);
    const personalData = await getCurrentConsentDocument(ConsentDocumentType.personal_data_consent);
    smoke.ok('текущее пользовательское соглашение опубликовано', Boolean(terms.version), terms.version);
    smoke.ok('текущее согласие на ПДн опубликовано', Boolean(personalData.version), personalData.version);
    smoke.eq('хэш документа совпадает с SHA-256 текста', terms.hash, hashConsentText(terms.text));
    smoke.ok('HTML документа сформирован', terms.html.length > 0);

    // Регистрация без согласий отклоняется.
    await smoke.fails(
      'регистрация без согласий отклоняется',
      () => registerApplicant({ email: testEmail, password: 'password123' }, META),
      'CONSENT_REQUIRED',
    );
    await smoke.fails(
      'регистрация с одним согласием отклоняется',
      () => registerApplicant({ email: testEmail, password: 'password123', accept_terms: true }, META),
      'CONSENT_REQUIRED',
    );

    // Регистрация с обоими согласиями создаёт пользователя и два события журнала.
    const user = await registerApplicant(
      {
        email: testEmail,
        password: 'password123',
        accept_terms: true,
        accept_personal_data_consent: true,
      },
      META,
    );
    userId = user.id;
    const events = await prisma.consent_events.findMany({ where: { user_id: user.id } });
    smoke.eq('журнал принятия: два события', events.length, 2);
    smoke.ok(
      'журнал принятия: сохранены IP и User-Agent',
      events.every((event) => event.ip_address === META.ip && event.user_agent === META.userAgent),
    );
    smoke.ok('журнал принятия: сохранён хэш редакции', events.every((event) => event.document_hash.length === 64));
    smoke.ok(
      'журнал принятия: оба типа документов зафиксированы',
      new Set(events.map((event) => event.document_type)).size === 2,
    );

    // Разрешение образцов ПДн: сначала docx.
    const minor = await getConsentTemplate('minor');
    const adult = await getConsentTemplate('adult');
    smoke.eq('образец для несовершеннолетних найден (docx)', minor.fileType, 'docx');
    smoke.eq('образец для совершеннолетних найден (docx)', adult.fileType, 'docx');
    smoke.ok('имя файла образца для скачивания осмысленно', adult.downloadName.endsWith('.docx'), adult.downloadName);

    // История редакций — только администратору.
    await smoke.fails(
      'эксперт не может читать историю редакций',
      () => listConsentDocuments(asExpert(admin.id, admin.email)),
      'FORBIDDEN',
    );
    const history = await listConsentDocuments(admin, ConsentDocumentType.terms);
    smoke.ok('администратор видит историю редакций', history.length >= 1);

    // Неизменяемость: повторная публикация той же версии отклоняется.
    const currentVersion = terms.version;
    await smoke.fails(
      'повторная публикация той же версии отклоняется',
      () => publishConsentDocument(admin, { document_type: ConsentDocumentType.terms, version: currentVersion, text: 'x' }),
      'CONSENT_DOCUMENT_VERSION_EXISTS',
    );

    // Новая версия публикуется отдельной строкой и не меняет старую.
    const created = await publishConsentDocument(admin, {
      document_type: ConsentDocumentType.terms,
      version: `smoke-${Date.now()}`,
      text: '# Смоук\nВременная редакция для проверки.',
    });
    publishedId = created.id;
    smoke.eq('новая редакция получает свой хэш', created.hash, hashConsentText(created.text));
    smoke.ok('старая редакция не изменена', (await getCurrentConsentDocument(ConsentDocumentType.terms)).id !== terms.id);

    // Проверяем, что buildConsentEvents формирует по записи на каждый документ.
    const documents = await requireRegistrationConsents({ accept_terms: true, accept_personal_data_consent: true });
    smoke.eq('buildConsentEvents: две записи', buildConsentEvents(999, documents, META).length, 2);
  } finally {
    if (publishedId !== null) await prisma.consent_documents.delete({ where: { id: publishedId } });
    if (userId !== null) await prisma.users.delete({ where: { id: userId } });
    await prisma.$disconnect();
  }

  smoke.done();
}

await main();
