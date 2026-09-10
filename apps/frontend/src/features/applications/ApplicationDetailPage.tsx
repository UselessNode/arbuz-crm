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
} from '../../components/ui';
import type { StatusOption } from '../../components/ui';
import { applicationsApi, type ApplicationDetail } from '../../api/applications';
import { statusesApi } from '../../api/references';
import { ApiError } from '../../api/client';
import { formatDateTime, formatUserName } from '../../lib/format';
import { ApplicationFormModal } from './ApplicationFormModal';
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

  const [application, setApplication] = useState<ApplicationDetail | null>(null);
  const [statusOptions, setStatusOptions] = useState<readonly StatusOption<string>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteSaving, setDeleteSaving] = useState(false);

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
    try {
      await applicationsApi.update(application.id, { status_id: Number(value) });
      await load();
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
      navigate('/admin/applications', { replace: true });
    } catch (caught) {
      setActionError(caught instanceof ApiError ? caught.message : 'Не удалось удалить заявку');
      setDeleteSaving(false);
      setDeleting(false);
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
