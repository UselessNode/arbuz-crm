// Карточка заявки: секции на переключаемых вкладках, статус и действия в шапке контейнера.
// Общая для администратора (`area="admin"`), заявителя (`area="applicant"`) и просмотра экспертом (`area="expert"`).
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Accordion,
  AccordionItem,
  Button,
  ConfirmDialog,
  Container,
  KebabMenu,
  SectionHint,
  StateMessage,
  StatusBadge,
  useToast,
} from '../../components/ui';
import type { SelectOption, StatusOption } from '../../components/ui';
import {
  applicationsApi,
  type ApplicationDetail,
  type ApplicationPayload,
  type ApplicationValidationIssue,
  type ApplicationValidationResult,
} from '../../api/applications';
import { directionsApi, statusesApi, tendersApi } from '../../api/references';
import { pdfExportApi } from '../../api/pdf-export';
import { usePdfExport } from '../../lib/use-pdf-export';
import { ApiError } from '../../api/client';
import { formatDateTime, formatUserName } from '../../lib/format';
import { ApplicationMainFields } from './ApplicationMainFields';
import { validateMainFields } from './validate-main';
import { renderSectionHintText } from './section-hint-text';
import { useSectionHints } from './use-section-hints';
import { ApplicationValidationDialog } from './ApplicationValidationDialog';
import { TeamMembersSection } from './TeamMembersSection';
import { PlansSection } from './PlansSection';
import { BudgetSection } from './BudgetSection';
import { MaterialsSection } from './MaterialsSection';
import { ReviewsSection } from './ReviewsSection';
import { ExpertEvaluationSection } from './ExpertEvaluationSection';
import styles from './Applications.module.css';

export type ApplicationArea = 'admin' | 'applicant' | 'expert';

interface Props {
  area?: ApplicationArea;
}

type SectionKey = 'main' | 'team' | 'plans' | 'budget' | 'materials' | 'reviews';
type ActiveTab = 'all' | SectionKey;

/** Данные заявки → редактируемое представление (для формы «Основное»). */
function toPayload(application: ApplicationDetail): ApplicationPayload {
  return {
    title: application.title,
    idea_description: application.ideaDescription,
    importance_to_team: application.importanceToTeam,
    project_goal: application.projectGoal,
    project_tasks: application.projectTasks,
    implementation_experience: application.implementationExperience,
    results_description: application.resultsDescription,
    tender_id: application.tender?.id ?? null,
    direction_id: application.direction?.id ?? null,
  };
}

/** Какие секции формы проверяет конкретное замечание сервера. */
function sectionsForIssue(issue: ApplicationValidationIssue): SectionKey[] {
  switch (issue.code) {
    case 'NO_MEMBERS':
    case 'NO_ADULT_COORDINATOR':
    case 'MISSING_CONSENT':
      return ['team'];
    default:
      return [];
  }
}

export function ApplicationDetailPage({ area = 'admin' }: Props) {
  const { applicationId } = useParams<{ applicationId: string }>();
  const navigate = useNavigate();
  const id = Number(applicationId);
  const toast = useToast();
  const hints = useSectionHints();
  const isAdmin = area === 'admin';
  const isExpertArea = area === 'expert';
  const listPath = isAdmin ? '/admin/applications' : isExpertArea ? '/expert' : '/applications';

  const [application, setApplication] = useState<ApplicationDetail | null>(null);
  const [statusOptions, setStatusOptions] = useState<readonly StatusOption<string>[]>([]);
  const [form, setForm] = useState<ApplicationPayload | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  /** Секции, подсвеченные по замечаниям сервера (клиентские ошибки «Основного» — из fieldErrors). */
  const [serverSectionErrors, setServerSectionErrors] = useState<ReadonlySet<SectionKey>>(new Set());
  /** Есть несохранённые правки — тихая перезагрузка не должна их затирать. */
  const dirtyRef = useRef(false);
  const [tenderOptions, setTenderOptions] = useState<readonly SelectOption<string>[]>([]);
  const [directionOptions, setDirectionOptions] = useState<readonly SelectOption<string>[]>([]);
  const [optionsLoading, setOptionsLoading] = useState(true);
  const [optionsError, setOptionsError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [tab, setTab] = useState<ActiveTab>('all');
  const [deleting, setDeleting] = useState(false);
  const [deleteSaving, setDeleteSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [validation, setValidation] = useState<ApplicationValidationResult | null>(null);
  /** Замечания проверки после явного «Сохранить» (не мешают сохранению). */
  const [saveIssues, setSaveIssues] = useState<ApplicationValidationResult | null>(null);

  const load = useCallback(
    async (silent = false) => {
      if (!Number.isInteger(id) || id <= 0) {
        setError('Некорректный идентификатор заявки');
        setLoading(false);
        return;
      }
      // Тихая перезагрузка (после действий в секциях) не сбрасывает скролл.
      if (!silent) setLoading(true);
      setError(null);
      try {
        const [detail, statuses] = await Promise.all([applicationsApi.get(id), statusesApi.list()]);
        setApplication(detail.application);
        setStatusOptions(statuses.statuses.map((status) => ({ value: String(status.id), label: status.name, tone: 'blue' })));
        // Не затираем несохранённые правки фоновым обновлением.
        if (!dirtyRef.current) setForm(toPayload(detail.application));
      } catch (caught) {
        setError(caught instanceof ApiError ? caught.message : 'Не удалось загрузить заявку');
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [id],
  );

  /** Обновление данных без потери состояния интерфейса. */
  const refresh = useCallback(() => load(true), [load]);

  useEffect(() => {
    void load();
  }, [load]);

  // Справочники конкурсов и направлений — один раз.
  useEffect(() => {
    let cancelled = false;
    setOptionsLoading(true);
    setOptionsError(null);
    Promise.all([tendersApi.list(), directionsApi.list()])
      .then(([tenders, directions]) => {
        if (cancelled) return;
        setTenderOptions(tenders.tenders.map((tender) => ({ value: String(tender.id), label: tender.name })));
        setDirectionOptions(directions.directions.map((direction) => ({ value: String(direction.id), label: direction.name })));
      })
      .catch((caught) => {
        if (!cancelled) setOptionsError(caught instanceof ApiError ? caught.message : 'Не удалось загрузить справочники');
      })
      .finally(() => {
        if (!cancelled) setOptionsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // При правке поля снимаем с него ошибку.
  const updateForm = useCallback((patch: Partial<ApplicationPayload>) => {
    dirtyRef.current = true;
    setForm((prev) => (prev ? { ...prev, ...patch } : prev));
    const patched = Object.keys(patch);
    setFieldErrors((prev) => {
      if (!patched.some((key) => key in prev)) return prev;
      const next = { ...prev };
      for (const key of patched) delete next[key];
      return next;
    });
  }, []);

  const changeStatus = async (value: string) => {
    if (!application || !isAdmin) return;
    setActionError(null);
    const targetId = application.id;
    const previousStatusId = application.status?.id;
    try {
      await applicationsApi.update(targetId, { status_id: Number(value) });
      await refresh();
      toast.showToast({
        message: 'Статус изменён',
        tone: 'success',
        action:
          previousStatusId === undefined
            ? undefined
            : {
                label: 'Отменить',
                onClick: () => {
                  void applicationsApi
                    .update(targetId, { status_id: previousStatusId })
                    .then(() => refresh())
                    .catch(() => {
                      setActionError('Не удалось отменить изменение статуса');
                      void refresh();
                    });
                },
              },
      });
    } catch (caught) {
      setActionError(caught instanceof ApiError ? caught.message : 'Не удалось изменить статус');
      await refresh();
    }
  };

  /** Сохраняет правки «Основного», если они есть. Бросает ошибку — вызывающая сторона ловит. */
  const persistForm = async () => {
    if (!application || !form || !dirtyRef.current) return;
    await applicationsApi.update(application.id, form);
    dirtyRef.current = false;
  };

  /** Клиентская проверка обязательных полей «Основного»: без неё сохранение и отправка блокируются. */
  const validateMain = (): boolean => {
    if (!form) return false;
    const errors = validateMainFields(form);
    if (Object.keys(errors).length === 0) return true;
    setFieldErrors(errors);
    setActionError('Заполните обязательные поля раздела «Основное»');
    setTab('main');
    return false;
  };

  /**
   * Явное сохранение карточки. Разделы (команда, план, бюджет, материалы) сохраняются
   * каждым действием сразу, поэтому кнопка сохраняет поля «Основного» и служит
   * понятной точкой «всё сохранено». Она же показывает замечания проверки заявки.
   */
  const handleSave = async () => {
    if (!application || !form) return;
    setActionError(null);
    setSaveIssues(null);
    if (!validateMain()) return;
    setSaving(true);
    try {
      await persistForm();
      await refresh();
      // Через эту же кнопку видно соблюдение правил проверки (набор правил будет расширяться).
      const check = await applicationsApi.validation(application.id);
      applySectionErrors(check);
      if (check.valid) {
        toast.showToast({ message: 'Изменения сохранены', tone: 'success' });
      } else {
        setSaveIssues(check);
        toast.showToast({ message: 'Сохранено, но есть замечания проверки', tone: 'info' });
      }
    } catch (caught) {
      setActionError(caught instanceof ApiError ? caught.message : 'Не удалось сохранить заявку');
    } finally {
      setSaving(false);
    }
  };

  /** Подсвечивает секции по замечаниям сервера и переключает на первую проблемную. */
  const applySectionErrors = (result: ApplicationValidationResult) => {
    const keys = new Set<SectionKey>();
    for (const issue of result.issues) for (const key of sectionsForIssue(issue)) keys.add(key);
    setServerSectionErrors(keys);
    if (keys.size > 0) setTab([...keys][0]);
  };

  const handleDelete = async () => {
    if (!application) return;
    setDeleteSaving(true);
    try {
      await applicationsApi.remove(application.id);
      toast.showToast({ message: 'Заявка удалена', tone: 'success' });
      navigate(listPath, { replace: true });
    } catch (caught) {
      setActionError(caught instanceof ApiError ? caught.message : 'Не удалось удалить заявку');
      setDeleteSaving(false);
      setDeleting(false);
    }
  };

  const runSubmit = async () => {
    if (!application) return;
    setSubmitting(true);
    setActionError(null);
    try {
      await applicationsApi.submit(application.id);
      setValidation(null);
      await refresh();
      toast.showToast({ message: 'Заявка отправлена на проверку', tone: 'success' });
    } catch (caught) {
      setActionError(caught instanceof ApiError ? caught.message : 'Не удалось отправить заявку');
    } finally {
      setSubmitting(false);
    }
  };

  const handleStartSubmit = async () => {
    if (!application || !form) return;
    setActionError(null);
    if (!validateMain()) return;
    setSubmitting(true);
    try {
      // Сначала сохраняем правки «Основного», чтобы проверка и отправка шли по актуальным данным.
      await persistForm();
      const result = await applicationsApi.validation(application.id);
      if (result.valid) await runSubmit();
      else {
        setValidation(result);
        applySectionErrors(result);
      }
    } catch (caught) {
      setActionError(caught instanceof ApiError ? caught.message : 'Не удалось проверить заявку');
    } finally {
      setSubmitting(false);
    }
  };

  // Подтверждённое удаление участников без согласия + повторная проверка и отправка.
  const handleRemoveWithoutConsent = async () => {
    if (!application || !validation) return;
    const ids = validation.issues.find((issue) => issue.code === 'MISSING_CONSENT')?.teamMemberIds ?? [];
    setSubmitting(true);
    setActionError(null);
    try {
      for (const memberId of ids) {
        await applicationsApi.teamMembers.remove(application.id, memberId);
      }
      const recheck = await applicationsApi.validation(application.id);
      await refresh();
      if (recheck.valid) {
        await applicationsApi.submit(application.id);
        setValidation(null);
        await refresh();
        toast.showToast({ message: 'Участники без согласия удалены, заявка отправлена', tone: 'success' });
      } else {
        setValidation(recheck);
        applySectionErrors(recheck);
        toast.showToast({ message: 'Состав обновлён', tone: 'success' });
      }
    } catch (caught) {
      setActionError(caught instanceof ApiError ? caught.message : 'Не удалось обновить состав заявки');
      setValidation(null);
    } finally {
      setSubmitting(false);
    }
  };

  // PDF-выгрузка доступна всем ролям — вынесена в kebab-меню шапки.
  const startPdf = useCallback(async () => {
    const { job } = await pdfExportApi.start(id);
    return job;
  }, [id]);
  const { run: runPdf } = usePdfExport({ start: startPdf, successMessage: 'Отчёт по заявке готов' });

  const meta = useMemo(() => {
    if (!application) return [];
    return [
      { label: 'Заявитель', value: application.owner ? formatUserName(application.owner) : '—' },
      { label: 'Создана', value: formatDateTime(application.createdAt) },
      { label: 'Отправлена', value: formatDateTime(application.submittedAt) },
    ];
  }, [application]);

  if (loading) return <StateMessage state="loading" />;
  if (error || !application || !form) {
    return <StateMessage state="error" message={error ?? 'Заявка не найдена'} onRetry={() => void load()} />;
  }

  // Владелец (в т.ч. назначенный админом) и админ редактируют; эксперт — только чтение.
  const canEdit = !isExpertArea;
  const canDelete = !isExpertArea && (isAdmin || !application.submittedAt);
  const canSubmit = !isExpertArea && !application.submittedAt;

  const sections: ReadonlyArray<{ key: SectionKey; label: string }> = [
    { key: 'main', label: 'Основное' },
    { key: 'team', label: `Команда (${application.teamMembers.length})` },
    { key: 'plans', label: `План мероприятий (${application.projectPlans.length})` },
    { key: 'budget', label: `Бюджет (${application.projectBudget.length})` },
    { key: 'materials', label: `Материалы (${application.materials.length})` },
    ...(isAdmin || isExpertArea
      ? [{ key: 'reviews' as const, label: `Экспертизы (${application.reviews.length})` }]
      : []),
  ];
  const allKeys = sections.map((item) => item.key);
  const activeTab: ActiveTab = tab === 'all' || sections.some((item) => item.key === tab) ? tab : 'all';
  const visibleKeys = activeTab === 'all' ? allKeys : [activeTab];
  const labelOf = (key: SectionKey) => sections.find((item) => item.key === key)?.label ?? '';
  const mainInvalid = Object.keys(fieldErrors).length > 0;
  const isSectionInvalid = (key: SectionKey) => serverSectionErrors.has(key) || (key === 'main' && mainInvalid);

  const tabs: ReadonlyArray<{ key: ActiveTab; label: string }> = [{ key: 'all', label: 'ВСЕ' }, ...sections];

  const kebabItems = [
    { key: 'pdf', label: 'Скачать PDF', icon: 'download', onSelect: () => void runPdf() },
    ...(canDelete
      ? [{ key: 'delete', label: 'Удалить', icon: 'delete', danger: true, onSelect: () => setDeleting(true) }]
      : []),
  ];

  const renderSection = (key: SectionKey) => {
    switch (key) {
      case 'team':
        return (
          <>
            <SectionHint>{renderSectionHintText(hints.team)}</SectionHint>
            <TeamMembersSection applicationId={application.id} members={application.teamMembers} readOnly={!canEdit} onChanged={refresh} />
          </>
        );
      case 'plans':
        return (
          <>
            <SectionHint>{renderSectionHintText(hints.plans)}</SectionHint>
            <PlansSection applicationId={application.id} plans={application.projectPlans} readOnly={!canEdit} onChanged={refresh} />
          </>
        );
      case 'budget':
        return (
          <>
            <SectionHint>{renderSectionHintText(hints.budget)}</SectionHint>
            <BudgetSection applicationId={application.id} items={application.projectBudget} readOnly={!canEdit} onChanged={refresh} />
          </>
        );
      case 'materials':
        return (
          <>
            <SectionHint>{renderSectionHintText(hints.materials)}</SectionHint>
            <MaterialsSection applicationId={application.id} materials={application.materials} readOnly={!canEdit} onChanged={refresh} />
          </>
        );
      case 'reviews':
        return (
          <>
            <SectionHint>{renderSectionHintText(hints.reviews)}</SectionHint>
            {isExpertArea ? <ExpertEvaluationSection application={application} onChanged={refresh} /> : null}
            {isAdmin ? (
              <ReviewsSection
                applicationId={application.id}
                reviews={application.reviews}
                canManage={isAdmin}
                requiredExperts={application.tender?.expertsCount}
                onChanged={refresh}
              />
            ) : null}
          </>
        );
      default:
        return (
          <>
            <SectionHint>{renderSectionHintText(hints.main)}</SectionHint>
            <ApplicationMainFields
              form={form}
              onChange={updateForm}
              tenderOptions={tenderOptions}
              directionOptions={directionOptions}
              optionsLoading={optionsLoading}
              optionsError={optionsError}
              errors={fieldErrors}
              disabled={!canEdit}
            />
            <div className={styles.meta}>
              {meta.map((item) => (
                <div key={item.label} className={styles.metaItem}>
                  <span className={styles.metaLabel}>{item.label}</span>
                  <span>{item.value}</span>
                </div>
              ))}
            </div>
          </>
        );
    }
  };

  return (
    <>
      <div className={styles.pageHead}>
        <h1 className={styles.pageTitle}>{isExpertArea ? 'Просмотр заявки' : 'Форма заявки'}</h1>
        <Button variant="secondary" icon="arrow-left" onClick={() => navigate(listPath)}>
          Вернуться
        </Button>
      </div>

      <div className={styles.tabs} role="tablist" aria-label="Разделы заявки">
        {tabs.map((item) => (
          <Button
            key={item.key}
            size="sm"
            variant={activeTab === item.key ? 'primary' : 'secondary'}
            role="tab"
            aria-selected={activeTab === item.key}
            className={isSectionInvalid(item.key as SectionKey) ? styles.tabError : undefined}
            onClick={() => setTab(item.key)}
          >
            {item.label}
          </Button>
        ))}
      </div>

      <Container
        title={
          <span className={styles.statusTitle}>
            <span className={styles.metaLabel}>Статус заявки:</span>
            <StatusBadge
              value={application.status ? String(application.status.id) : ''}
              options={statusOptions}
              onChange={isAdmin && application.status ? (value) => void changeStatus(value) : undefined}
            />
          </span>
        }
        actions={
          <>
            {canEdit ? (
              <Button icon="check" loading={saving} onClick={() => void handleSave()}>
                Сохранить
              </Button>
            ) : null}
            {canSubmit ? (
              <Button icon="check" loading={submitting} onClick={() => void handleStartSubmit()}>
                Отправить на проверку
              </Button>
            ) : null}
            <KebabMenu items={kebabItems} label="Действия с заявкой" />
          </>
        }
      >
        {actionError ? <div className={styles.error}>{actionError}</div> : null}
        {saveIssues && !saveIssues.valid ? (
          <div className={styles.saveIssues}>
            <strong>Замечания проверки ({saveIssues.issues.length})</strong>
            <ul className={styles.saveIssuesList}>
              {saveIssues.issues.map((issue, index) => (
                <li key={`${index}-${issue.code}`}>{issue.message}</li>
              ))}
            </ul>
            <span className={styles.metaLabel}>Сохранению не мешают — они нужны для отправки заявки на проверку.</span>
          </div>
        ) : null}

        <Accordion key={activeTab} allowMultiple>
          {visibleKeys.map((key) => (
            <AccordionItem
              key={key}
              itemKey={key}
              title={labelOf(key)}
              defaultOpen
              invalid={isSectionInvalid(key)}
            >
              {renderSection(key)}
            </AccordionItem>
          ))}
        </Accordion>
      </Container>

      <ApplicationValidationDialog
        result={validation}
        saving={submitting}
        onClose={() => setValidation(null)}
        onRemoveWithoutConsent={() => void handleRemoveWithoutConsent()}
      />
      <ConfirmDialog
        open={deleting}
        title="Удаление заявки"
        message="Удалить заявку? Действие необратимо (мягкое удаление)."
        confirmLabel="Удалить"
        danger
        loading={deleteSaving}
        onConfirm={() => void handleDelete()}
        onClose={() => setDeleting(false)}
      />
    </>
  );
}
