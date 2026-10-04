// Модалка создания/редактирования заявки: основные поля и привязка владельца (админ).
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Button, Input, Modal, Select, Textarea, useToast } from '../../components/ui';
import type { SelectOption } from '../../components/ui';
import { applicationsApi, type ApplicationDetail, type ApplicationPayload } from '../../api/applications';
import { directionsApi, tendersApi } from '../../api/references';
import { usersApi } from '../../api/users';
import { ApiError } from '../../api/client';
import { Roles } from '../../lib/roles';
import { formatUserName } from '../../lib/format';
import styles from './Applications.module.css';

interface Props {
  open: boolean;
  mode: 'create' | 'edit';
  application?: ApplicationDetail | null;
  /** Показывать выбор владельца (только администратор при создании). */
  canAssignOwner?: boolean;
  onClose: () => void;
  /** `created` — созданная заявка (при создании) либо null (при редактировании). */
  onSaved: (created: ApplicationDetail | null) => void;
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

export function ApplicationFormModal({ open, mode, application, canAssignOwner = false, onClose, onSaved }: Props) {
  const toast = useToast();
  // Какая кнопка отправила форму: «Сохранить» (остаться) или «Сохранить и выйти».
  const keepOpenRef = useRef(false);
  const [form, setForm] = useState<ApplicationPayload>(emptyForm());
  const [tenderId, setTenderId] = useState('');
  const [directionId, setDirectionId] = useState('');
  const [ownerId, setOwnerId] = useState('');
  const [tenderOptions, setTenderOptions] = useState<readonly SelectOption<string>[]>([]);
  const [directionOptions, setDirectionOptions] = useState<readonly SelectOption<string>[]>([]);
  const [ownerOptions, setOwnerOptions] = useState<readonly SelectOption<string>[]>([]);
  const [optionsLoading, setOptionsLoading] = useState(false);
  const [optionsError, setOptionsError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setOptionsError(null);
    setOptionsLoading(true);

    const requests: Promise<void>[] = [
      Promise.all([tendersApi.list(), directionsApi.list()]).then(([tenders, directions]) => {
        setTenderOptions(tenders.tenders.map((tender) => ({ value: String(tender.id), label: tender.name })));
        setDirectionOptions(directions.directions.map((direction) => ({ value: String(direction.id), label: direction.name })));
      }),
    ];
    if (canAssignOwner && mode === 'create') {
      requests.push(
        usersApi.list({ roles: [Roles.applicant], limit: 100, offset: 0 }).then((response) => {
          setOwnerOptions(
            response.users.map((user) => ({ value: String(user.id), label: `${formatUserName(user)} (${user.email})` })),
          );
        }),
      );
    }

    Promise.all(requests)
      .catch((caught) => {
        setOptionsError(caught instanceof ApiError ? caught.message : 'Не удалось загрузить справочники');
      })
      .finally(() => setOptionsLoading(false));

    if (mode === 'edit' && application) {
      setForm({
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
      setTenderId(application.tender ? String(application.tender.id) : '');
      setDirectionId(application.direction ? String(application.direction.id) : '');
    } else {
      setForm(emptyForm());
      setTenderId('');
      setDirectionId('');
    }
    setOwnerId(application?.ownerId ? String(application.ownerId) : '');
    setError(null);
  }, [open, mode, application, canAssignOwner]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (mode === 'create' && canAssignOwner && !ownerId) {
      setError('Выберите заявителя (владельца) заявки');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const base = {
        ...form,
        tender_id: tenderId ? Number(tenderId) : null,
        direction_id: directionId ? Number(directionId) : null,
      };
      if (mode === 'edit' && application) {
        await applicationsApi.update(application.id, base);
        onSaved(null);
      } else {
        const response = await applicationsApi.create({ ...base, owner_id: ownerId ? Number(ownerId) : undefined });
        onSaved(response.application);
      }
      if (keepOpenRef.current) {
        toast.showToast({ message: 'Изменения сохранены', tone: 'success' });
      } else {
        onClose();
      }
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Не удалось сохранить заявку');
    } finally {
      keepOpenRef.current = false;
      setSaving(false);
    }
  };

  return (
    <Modal open={open} title={mode === 'edit' ? 'Редактирование заявки' : 'Новая заявка'} onClose={onClose} width={640}>
      <form className={styles.form} onSubmit={handleSubmit}>
        <Input label="Название" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
        {canAssignOwner && mode === 'create' ? (
          <Select
            label="Заявитель (владелец)"
            placeholder="Выберите пользователя"
            value={ownerId}
            onChange={setOwnerId}
            options={ownerOptions}
            disabled={optionsLoading}
          />
        ) : null}
        <div className={styles.grid2}>
          <Select label="Конкурс" placeholder="Не выбрано" value={tenderId} onChange={setTenderId} options={tenderOptions} disabled={optionsLoading} />
          <Select label="Направление" placeholder="Не выбрано" value={directionId} onChange={setDirectionId} options={directionOptions} disabled={optionsLoading} />
        </div>
        {optionsError ? <div className={styles.error}>{optionsError}</div> : null}
        <Textarea label="Идея проекта" value={form.idea_description} onChange={(e) => setForm({ ...form, idea_description: e.target.value })} required />
        <Textarea
          label="Значимость для команды"
          value={form.importance_to_team}
          onChange={(e) => setForm({ ...form, importance_to_team: e.target.value })}
          required
        />
        <Textarea label="Цель проекта" value={form.project_goal} onChange={(e) => setForm({ ...form, project_goal: e.target.value })} required />
        <Textarea label="Задачи проекта" value={form.project_tasks} onChange={(e) => setForm({ ...form, project_tasks: e.target.value })} required />
        <Textarea
          label="Опыт реализации"
          value={form.implementation_experience ?? ''}
          onChange={(e) => setForm({ ...form, implementation_experience: e.target.value })}
        />
        <Textarea
          label="Ожидаемые результаты"
          value={form.results_description ?? ''}
          onChange={(e) => setForm({ ...form, results_description: e.target.value })}
        />
        {error ? <div className={styles.error}>{error}</div> : null}
        <div className={styles.formActions}>
          <Button variant="secondary" type="button" onClick={onClose} disabled={saving}>
            Отмена
          </Button>
          {mode === 'edit' ? (
            <Button
              variant="secondary"
              type="submit"
              icon="check"
              loading={saving}
              onClick={() => {
                keepOpenRef.current = true;
              }}
            >
              Сохранить
            </Button>
          ) : null}
          <Button
            type="submit"
            icon="check"
            loading={saving}
            onClick={() => {
              keepOpenRef.current = false;
            }}
          >
            Сохранить и выйти
          </Button>
        </div>
      </form>
    </Modal>
  );
}
