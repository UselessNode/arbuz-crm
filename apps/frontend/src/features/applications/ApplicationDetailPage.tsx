// Карточка заявки (админ): основные данные, состав, статус, рецензии.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Accordion,
  AccordionItem,
  Button,
  ConfirmDialog,
  Container,
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
import { TeamMembersSection } from './TeamMembersSection';
import { PlansSection } from './PlansSection';
import { BudgetSection } from './BudgetSection';
import { MaterialsSection } from './MaterialsSection';
import { ReviewsSection } from './ReviewsSection';
import styles from './Applications.module.css';

export function ApplicationDetailPage() {
  const { applicationId } = useParams<{ applicationId: string }>();
  const navigate = useNavigate();
  const id = Number(applicationId);
  const toast = useToast();

  const [application, setApplication] = useState<ApplicationDetail | null>(null);
  const [statusOptions, setStatusOptions] = useState<readonly StatusOption<string>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteSaving, setDeleteSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [validation, setValidation] = useState<ApplicationValidationResult | null>(null);

  const load = useCallback(async () => {
    if (!Number.isInteger(id) || id <= 0) {
      setError('Некорректный идентификатор заявки');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [detail, statuses] = await Promise.all([applicationsApi.get(id), statusesApi.list()]);
      setApplication(detail.application);
      setStatusOptions(statuses.statuses.map((status) => ({ value: String(status.id), label: status.name, tone: 'blue' })));
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Не удалось загрузить заявку');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const changeStatus = async (value: string) => {
    if (!application) return;
    setActionError(null);
    const targetId = application.id;
    const previousStatusId = application.status?.id;
    try {
      await applicationsApi.update(targetId, { status_id: Number(value) });
      await load();
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
                    .then(() => load())
                    .catch(() => {
                      setActionError('Не удалось отменить изменение статуса');
                      void load();
                    });
                },
              },
      });
    } catch (caught) {
      setActionError(caught instanceof ApiError ? caught.message : 'Не удалось изменить статус');
      await load();
    }
  };

  const handleDelete = async () => {
    if (!application) return;
    setDeleteSaving(true);
    try {
      await applicationsApi.remove(application.id);
      toast.showToast({ message: 'Заявка удалена', tone: 'success' });
      navigate('/admin/applications', { replace: true });
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
      await load();
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
      await load();
      if (recheck.valid) {
        await applicationsApi.submit(application.id);
        setValidation(null);
        await load();
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
      { label: 'Тендер', value: application.tender?.name ?? '—' },
      { label: 'Направление', value: application.direction?.name ?? '—' },
      { label: 'Создана', value: formatDateTime(application.createdAt) },
      { label: 'Отправлена', value: formatDateTime(application.submittedAt) },
    ];
  }, [application]);

  if (loading) return <StateMessage state="loading" />;
  if (error || !application) return <StateMessage state="error" message={error ?? 'Заявка не найдена'} onRetry={() => void load()} />;

  return (
    <>
      <Container
        title={application.title}
        actions={
          <>
            {!application.submittedAt ? (
              <Button icon="check" loading={submitting} onClick={() => void handleStartSubmit()}>
                Отправить на проверку
              </Button>
            ) : null}
            <Button variant="secondary" icon="edit" onClick={() => setEditing(true)}>
              Редактировать
            </Button>
            <Button variant="danger" icon="delete" onClick={() => setDeleting(true)}>
              Удалить
            </Button>
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
                onChange={application.status ? (value) => void changeStatus(value) : undefined}
              />
            </div>
          </div>
          <div className={styles.meta}>
            {meta.map((item) => (
              <div key={item.label} className={styles.metaItem}>
                <span className={styles.metaLabel}>{item.label}</span>
                <span>{item.value}</span>
              </div>
            ))}
          </div>
        </div>
        {actionError ? <div className={styles.error}>{actionError}</div> : null}

        <Accordion allowMultiple>
          <AccordionItem itemKey="main" title="Основное" defaultOpen>
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

          <AccordionItem itemKey="team" title={`Команда (${application.teamMembers.length})`}>
            <TeamMembersSection applicationId={application.id} members={application.teamMembers} onChanged={load} />
          </AccordionItem>

          <AccordionItem itemKey="plans" title={`План мероприятий (${application.projectPlans.length})`}>
            <PlansSection applicationId={application.id} plans={application.projectPlans} onChanged={load} />
          </AccordionItem>

          <AccordionItem itemKey="budget" title={`Бюджет (${application.projectBudget.length})`}>
            <BudgetSection applicationId={application.id} items={application.projectBudget} onChanged={load} />
          </AccordionItem>

          <AccordionItem itemKey="materials" title={`Материалы (${application.materials.length})`}>
            <MaterialsSection applicationId={application.id} materials={application.materials} onChanged={load} />
          </AccordionItem>

          <AccordionItem itemKey="reviews" title={`Рецензии (${application.reviews.length})`}>
            <ReviewsSection applicationId={application.id} reviews={application.reviews} onChanged={load} />
          </AccordionItem>
        </Accordion>
      </Container>

      <ApplicationFormModal open={editing} application={application} onClose={() => setEditing(false)} onSaved={load} />
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
