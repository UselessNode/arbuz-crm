// Карточка заявки: основные данные, состав, статус, экспертизы.
// Общая для администратора (`area="admin"`) и заявителя (`area="applicant"`).
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Accordion,
  AccordionItem,
  Button,
  ConfirmDialog,
  Container,
  SectionHint,
  StateMessage,
  StatusBadge,
  useToast,
} from '../../components/ui';
import type { StatusOption } from '../../components/ui';
import { applicationsApi, type ApplicationDetail, type ApplicationValidationResult } from '../../api/applications';
import { statusesApi } from '../../api/references';
import { ApiError } from '../../api/client';
import { formatDateTime, formatUserName } from '../../lib/format';
import { ApplicationFormModal } from './ApplicationFormModal';
import { ApplicationValidationDialog } from './ApplicationValidationDialog';
import { PdfExportButton } from './PdfExportButton';
import { TeamMembersSection } from './TeamMembersSection';
import { PlansSection } from './PlansSection';
import { BudgetSection } from './BudgetSection';
import { MaterialsSection } from './MaterialsSection';
import { ReviewsSection } from './ReviewsSection';
import { ExpertEvaluationSection } from './ExpertEvaluationSection';
import { APPLICATION_SECTION_HINTS } from './section-hints';
import styles from './Applications.module.css';

export type ApplicationArea = 'admin' | 'applicant' | 'expert';

interface Props {
  area?: ApplicationArea;
}

export function ApplicationDetailPage({ area = 'admin' }: Props) {
  const { applicationId } = useParams<{ applicationId: string }>();
  const navigate = useNavigate();
  const id = Number(applicationId);
  const toast = useToast();
  const isAdmin = area === 'admin';
  const isExpertArea = area === 'expert';
  const listPath = isAdmin ? '/admin/applications' : isExpertArea ? '/expert' : '/applications';

  const [application, setApplication] = useState<ApplicationDetail | null>(null);
  const [statusOptions, setStatusOptions] = useState<readonly StatusOption<string>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
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
      // Тихая перезагрузка (после действий в секциях) не сбрасывает аккордеоны и скролл.
      if (!silent) setLoading(true);
      setError(null);
      try {
        const [detail, statuses] = await Promise.all([applicationsApi.get(id), statusesApi.list()]);
        setApplication(detail.application);
        setStatusOptions(statuses.statuses.map((status) => ({ value: String(status.id), label: status.name, tone: 'blue' })));
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

  /**
   * Явное сохранение карточки. Разделы (команда, план, бюджет, материалы) сохраняются
   * каждым действием сразу, поэтому кнопка дублирует сохранение основных полей и служит
   * понятной точкой «всё сохранено». Она же показывает замечания проверки заявки.
   */
  const handleSave = async () => {
    if (!application) return;
    setSaving(true);
    setActionError(null);
    setSaveIssues(null);
    try {
      await applicationsApi.update(application.id, {
        title: application.title,
        idea_description: application.ideaDescription,
        importance_to_team: application.importanceToTeam,
        project_goal: application.projectGoal,
        project_tasks: application.projectTasks,
        implementation_experience: application.implementationExperience,
        results_description: application.resultsDescription,
        tender_id: application.tender?.id ?? null,
        direction_id: application.direction?.id ?? null,
      });
      await refresh();
      // Через эту же кнопку видно соблюдение правил проверки (набор правил будет расширяться).
      const check = await applicationsApi.validation(application.id);
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
    if (!application) return;
    setActionError(null);
    try {
      const result = await applicationsApi.validation(application.id);
      if (result.valid) await runSubmit();
      else setValidation(result);
    } catch (caught) {
      setActionError(caught instanceof ApiError ? caught.message : 'Не удалось проверить заявку');
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
        toast.showToast({ message: 'Состав обновлён', tone: 'success' });
      }
    } catch (caught) {
      setActionError(caught instanceof ApiError ? caught.message : 'Не удалось обновить состав заявки');
      setValidation(null);
    } finally {
      setSubmitting(false);
    }
  };

  const meta = useMemo(() => {
    if (!application) return [];
    return [
      { label: 'Заявитель', value: application.owner ? formatUserName(application.owner) : '—' },
      { label: 'Конкурс', value: application.tender?.name ?? '—' },
      { label: 'Направление', value: application.direction?.name ?? '—' },
      { label: 'Создана', value: formatDateTime(application.createdAt) },
      { label: 'Отправлена', value: formatDateTime(application.submittedAt) },
    ];
  }, [application]);

  if (loading) return <StateMessage state="loading" />;
  if (error || !application) return <StateMessage state="error" message={error ?? 'Заявка не найдена'} onRetry={() => void load()} />;

  // Владелец (в т.ч. назначенный админом) и админ редактируют; эксперт — только чтение.
  const canEdit = !isExpertArea;
  const canDelete = !isExpertArea && (isAdmin || !application.submittedAt);
  const canSubmit = !isExpertArea && !application.submittedAt;

  return (
    <>
      <Container
        title={application.title}
        actions={
          <>
            <Button variant="secondary" icon="arrow-left" onClick={() => navigate(listPath)}>
              Назад
            </Button>
            <PdfExportButton applicationId={application.id} />
            {canSubmit ? (
              <Button icon="check" loading={submitting} onClick={() => void handleStartSubmit()}>
                Отправить на проверку
              </Button>
            ) : null}
            {canEdit ? (
              <Button variant="secondary" icon="check" loading={saving} onClick={() => void handleSave()}>
                Сохранить
              </Button>
            ) : null}
            {canEdit ? (
              <Button variant="secondary" icon="edit" onClick={() => setEditing(true)}>
                Редактировать
              </Button>
            ) : null}
            {canDelete ? (
              <Button variant="danger" icon="delete" onClick={() => setDeleting(true)}>
                Удалить
              </Button>
            ) : null}
          </>
        }
      >
        <div className={styles.header}>
          <div className={styles.titleBlock}>
            <span className={styles.metaLabel}>Статус заявки</span>
            <div className={styles.statusRow}>
              <StatusBadge
                value={application.status ? String(application.status.id) : ''}
                options={statusOptions}
                onChange={isAdmin && application.status ? (value) => void changeStatus(value) : undefined}
              />
            </div>
          </div>
        </div>
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

        <Accordion allowMultiple>
          <AccordionItem itemKey="meta" title="Основные данные" defaultOpen>
            <div className={styles.meta}>
              {meta.map((item) => (
                <div key={item.label} className={styles.metaItem}>
                  <span className={styles.metaLabel}>{item.label}</span>
                  <span>{item.value}</span>
                </div>
              ))}
            </div>
          </AccordionItem>

          <AccordionItem itemKey="main" title="Основное" defaultOpen>
            <SectionHint>{APPLICATION_SECTION_HINTS.main}</SectionHint>
            <div className={styles.metaLabel}>Идея проекта</div>
            <p className={styles.paragraph}>{application.ideaDescription || '—'}</p>
            <div className={styles.metaLabel}>Значимость для команды</div>
            <p className={styles.paragraph}>{application.importanceToTeam || '—'}</p>
            <div className={styles.metaLabel}>Цель проекта</div>
            <p className={styles.paragraph}>{application.projectGoal || '—'}</p>
            <div className={styles.metaLabel}>Задачи проекта</div>
            <p className={styles.paragraph}>{application.projectTasks || '—'}</p>
            <div className={styles.metaLabel}>Опыт реализации</div>
            <p className={styles.paragraph}>{application.implementationExperience || '—'}</p>
            <div className={styles.metaLabel}>Ожидаемые результаты</div>
            <p className={styles.paragraph}>{application.resultsDescription || '—'}</p>
          </AccordionItem>

          <AccordionItem itemKey="team" title={`Команда (${application.teamMembers.length})`} defaultOpen>
            <SectionHint>{APPLICATION_SECTION_HINTS.team}</SectionHint>
            <TeamMembersSection applicationId={application.id} members={application.teamMembers} readOnly={!canEdit} onChanged={refresh} />
          </AccordionItem>

          <AccordionItem itemKey="plans" title={`План мероприятий (${application.projectPlans.length})`} defaultOpen>
            <SectionHint>{APPLICATION_SECTION_HINTS.plans}</SectionHint>
            <PlansSection applicationId={application.id} plans={application.projectPlans} readOnly={!canEdit} onChanged={refresh} />
          </AccordionItem>

          <AccordionItem itemKey="budget" title={`Бюджет (${application.projectBudget.length})`} defaultOpen>
            <SectionHint>{APPLICATION_SECTION_HINTS.budget}</SectionHint>
            <BudgetSection applicationId={application.id} items={application.projectBudget} readOnly={!canEdit} onChanged={refresh} />
          </AccordionItem>

          <AccordionItem itemKey="materials" title={`Материалы (${application.materials.length})`} defaultOpen>
            <SectionHint>{APPLICATION_SECTION_HINTS.materials}</SectionHint>
            <MaterialsSection applicationId={application.id} materials={application.materials} readOnly={!canEdit} onChanged={refresh} />
          </AccordionItem>

          <AccordionItem itemKey="reviews" title={`Экспертизы (${application.reviews.length})`} defaultOpen>
            <SectionHint>{APPLICATION_SECTION_HINTS.reviews}</SectionHint>
            {isExpertArea ? <ExpertEvaluationSection application={application} onChanged={refresh} /> : null}
            {isAdmin ? <ReviewsSection
              applicationId={application.id}
              reviews={application.reviews}
              canManage={isAdmin}
              requiredExperts={application.tender?.expertsCount}
              onChanged={refresh}
            /> : null}
          </AccordionItem>
        </Accordion>
      </Container>

      <ApplicationFormModal
        open={editing}
        mode="edit"
        application={application}
        onClose={() => setEditing(false)}
        onSaved={() => void refresh()}
      />
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
