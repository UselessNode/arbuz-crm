// Форма создания заявки (админ/заявитель). Открывается сразу из списка, без промежуточной модалки.
// После создания заявки переходим в её карточку, где доступны остальные секции (команда, план и т.д.).
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Accordion, AccordionItem, Button, Container, SectionHint, StateMessage, useToast } from '../../components/ui';
import type { SelectOption } from '../../components/ui';
import { applicationsApi, type ApplicationPayload } from '../../api/applications';
import { directionsApi, tendersApi } from '../../api/references';
import { usersApi } from '../../api/users';
import { ApiError } from '../../api/client';
import { Roles } from '../../lib/roles';
import { formatUserName } from '../../lib/format';
import { ApplicationMainFields } from './ApplicationMainFields';
import { validateMainFields } from './validate-main';
import { renderSectionHintText } from './section-hint-text';
import { useSectionHints } from './use-section-hints';
import styles from './Applications.module.css';

interface Props {
  area?: 'admin' | 'applicant';
}

const emptyForm = (): ApplicationPayload => ({
  title: '',
  idea_description: '',
  importance_to_team: '',
  project_goal: '',
  project_tasks: '',
  implementation_experience: '',
  results_description: '',
  tender_id: null,
  direction_id: null,
});

/** Разделы формы — совпадают с карточкой заявки (см. ApplicationDetailPage). */
const SECTIONS: ReadonlyArray<{ key: string; label: string }> = [
  { key: 'main', label: 'Основное' },
  { key: 'team', label: 'Команда' },
  { key: 'plans', label: 'План мероприятий' },
  { key: 'budget', label: 'Бюджет' },
  { key: 'materials', label: 'Материалы' },
];

export function ApplicationCreatePage({ area = 'applicant' }: Props) {
  const navigate = useNavigate();
  const toast = useToast();
  const hints = useSectionHints();
  const isAdmin = area === 'admin';
  const listPath = isAdmin ? '/admin/applications' : '/applications';

  const [form, setForm] = useState<ApplicationPayload>(emptyForm());
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [ownerId, setOwnerId] = useState('');
  const [tenderOptions, setTenderOptions] = useState<readonly SelectOption<string>[]>([]);
  const [directionOptions, setDirectionOptions] = useState<readonly SelectOption<string>[]>([]);
  const [ownerOptions, setOwnerOptions] = useState<readonly SelectOption<string>[]>([]);
  const [optionsLoading, setOptionsLoading] = useState(true);
  const [optionsError, setOptionsError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setOptionsLoading(true);
    setOptionsError(null);
    const requests: Promise<unknown>[] = [
      Promise.all([tendersApi.list(), directionsApi.list()]).then(([tenders, directions]) => {
        if (cancelled) return;
        setTenderOptions(tenders.tenders.map((tender) => ({ value: String(tender.id), label: tender.name })));
        setDirectionOptions(directions.directions.map((direction) => ({ value: String(direction.id), label: direction.name })));
      }),
    ];
    if (isAdmin) {
      requests.push(
        usersApi.list({ roles: [Roles.applicant], limit: 100, offset: 0 }).then((response) => {
          if (cancelled) return;
          setOwnerOptions(
            response.users.map((user) => ({ value: String(user.id), label: `${formatUserName(user)} (${user.email})` })),
          );
        }),
      );
    }
    Promise.all(requests)
      .catch((caught) => {
        if (!cancelled) setOptionsError(caught instanceof ApiError ? caught.message : 'Не удалось загрузить справочники');
      })
      .finally(() => {
        if (!cancelled) setOptionsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isAdmin]);

  const updateForm = (patch: Partial<ApplicationPayload>) => {
    setForm((prev) => ({ ...prev, ...patch }));
    setFieldErrors((prev) => {
      if (!Object.keys(patch).some((key) => key in prev)) return prev;
      const next = { ...prev };
      for (const key of Object.keys(patch)) delete next[key];
      return next;
    });
  };

  const handleSubmit = async () => {
    setError(null);
    const errors = validateMainFields(form);
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setError('Заполните обязательные поля раздела «Основное»');
      return;
    }
    if (isAdmin && !ownerId) {
      setError('Выберите заявителя (владельца) заявки');
      return;
    }
    setSaving(true);
    try {
      const response = await applicationsApi.create({
        ...form,
        owner_id: ownerId ? Number(ownerId) : undefined,
      });
      toast.showToast({ message: 'Заявка создана', tone: 'success' });
      navigate(isAdmin ? `/admin/applications/${response.application.id}` : `/applications/${response.application.id}`, {
        replace: true,
      });
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Не удалось создать заявку');
    } finally {
      setSaving(false);
    }
  };

  const hasErrors = Object.keys(fieldErrors).length > 0;

  return (
    <>
      <div className={styles.pageHead}>
        <h1 className={styles.pageTitle}>Форма заявки</h1>
        <Button variant="secondary" icon="arrow-left" onClick={() => navigate(listPath)}>
          Вернуться
        </Button>
      </div>

      <div className={styles.tabs} role="tablist" aria-label="Разделы заявки">
        {SECTIONS.map((section) => (
          <Button
            key={section.key}
            size="sm"
            variant={section.key === 'main' ? 'primary' : 'secondary'}
            className={section.key === 'main' && hasErrors ? styles.tabError : undefined}
            disabled={section.key !== 'main'}
            title={section.key === 'main' ? undefined : 'Станут доступны после создания заявки'}
          >
            {section.label}
          </Button>
        ))}
      </div>

      <Container
        title="Новая заявка"
        actions={
          <Button icon="check" loading={saving} onClick={() => void handleSubmit()}>
            Создать заявку
          </Button>
        }
      >
        {error ? <div className={styles.error}>{error}</div> : null}
        <Accordion allowMultiple>
          <AccordionItem itemKey="main" title="Основное" defaultOpen invalid={hasErrors}>
            <SectionHint>{renderSectionHintText(hints.main)}</SectionHint>
            <ApplicationMainFields
              form={form}
              onChange={updateForm}
              tenderOptions={tenderOptions}
              directionOptions={directionOptions}
              optionsLoading={optionsLoading}
              optionsError={optionsError}
              errors={fieldErrors}
              owner={
                isAdmin
                  ? { value: ownerId, options: ownerOptions, onChange: setOwnerId }
                  : undefined
              }
            />
            <p className={styles.pageHint}>
              После создания заявки карточка откроется полностью — станут доступны разделы команды,
              плана мероприятий, бюджета и материалов (ниже показано, что появится).
            </p>
          </AccordionItem>

          {/* Остальные разделы в создании недоступны (нет ещё заявки), но показаны,
              чтобы структура формы совпадала с формой редактирования. */}
          {SECTIONS.filter((section) => section.key !== 'main').map((section) => (
            <AccordionItem key={section.key} itemKey={section.key} title={section.label}>
              <StateMessage state="empty" message="Раздел станет доступен после создания заявки" />
            </AccordionItem>
          ))}
        </Accordion>
      </Container>
    </>
  );
}
