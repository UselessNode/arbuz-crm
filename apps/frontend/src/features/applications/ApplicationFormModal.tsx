// Модалка редактирования основных полей заявки.
import { useEffect, useState, type FormEvent } from 'react';
import { Button, Input, Modal, Select, Textarea } from '../../components/ui';
import type { SelectOption } from '../../components/ui';
import { applicationsApi, type ApplicationDetail, type ApplicationPayload } from '../../api/applications';
import { directionsApi, tendersApi } from '../../api/references';
import { ApiError } from '../../api/client';
import styles from './Applications.module.css';

interface Props {
  open: boolean;
  application: ApplicationDetail | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}

export function ApplicationFormModal({ open, application, onClose, onSaved }: Props) {
  const [form, setForm] = useState<ApplicationPayload>({
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
  const [tenderId, setTenderId] = useState('');
  const [directionId, setDirectionId] = useState('');
  const [tenderOptions, setTenderOptions] = useState<readonly SelectOption<string>[]>([]);
  const [directionOptions, setDirectionOptions] = useState<readonly SelectOption<string>[]>([]);
  const [optionsLoading, setOptionsLoading] = useState(false);
  const [optionsError, setOptionsError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setOptionsError(null);
    setOptionsLoading(true);
    Promise.all([tendersApi.list(), directionsApi.list()])
      .then(([tenders, directions]) => {
        setTenderOptions(tenders.tenders.map((t) => ({ value: String(t.id), label: t.name })));
        setDirectionOptions(directions.directions.map((d) => ({ value: String(d.id), label: d.name })));
      })
      .catch((caught) => {
        setOptionsError(caught instanceof ApiError ? caught.message : 'Не удалось загрузить конкурсы и направления');
      })
      .finally(() => setOptionsLoading(false));

    if (application) {
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
    }
    setError(null);
  }, [open, application]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!application) return;
    setSaving(true);
    setError(null);
    try {
      await applicationsApi.update(application.id, {
        ...form,
        tender_id: tenderId ? Number(tenderId) : null,
        direction_id: directionId ? Number(directionId) : null,
      });
      await onSaved();
      onClose();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Не удалось сохранить');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} title="Редактирование заявки" onClose={onClose} width={640}>
      <form className={styles.form} onSubmit={handleSubmit}>
        <Input label="Название" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
        <div className={styles.grid2}>
          <Select label="Тендер" placeholder="Не выбрано" value={tenderId} onChange={setTenderId} options={tenderOptions} disabled={optionsLoading} />
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
          <Button type="submit" icon="check" loading={saving}>
            Сохранить
          </Button>
        </div>
      </form>
    </Modal>
  );
}
