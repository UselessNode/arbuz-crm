// Секция «План мероприятий» в карточке заявки.
import { useState, type FormEvent } from 'react';
import { Button, ConfirmDialog, DatePicker, Input, Modal, StateMessage, Table } from '../../components/ui';
import type { TableColumn } from '../../components/ui';
import { applicationsApi, type PlanPayload, type ProjectPlan } from '../../api/applications';
import { ApiError } from '../../api/client';
import { formatDateTime } from '../../lib/format';
import styles from './Applications.module.css';

interface Props {
  applicationId: number;
  plans: ProjectPlan[];
  onChanged: () => Promise<void>;
}

const emptyForm = (): PlanPayload => ({ task: '', event_name: '', event_description: '', start_date: '', end_date: '' });

export function PlansSection({ applicationId, plans, onChanged }: Props) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ProjectPlan | null>(null);
  const [form, setForm] = useState<PlanPayload>(emptyForm());
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<ProjectPlan | null>(null);
  const [deleteSaving, setDeleteSaving] = useState(false);

  const startCreate = () => {
    setEditing(null);
    setForm(emptyForm());
    setError(null);
    setOpen(true);
  };

  const startEdit = (plan: ProjectPlan) => {
    setEditing(plan);
    setForm({
      task: plan.task,
      event_name: plan.eventName,
      event_description: plan.eventDescription,
      start_date: plan.startDate ? plan.startDate.slice(0, 10) : '',
      end_date: plan.endDate ? plan.endDate.slice(0, 10) : '',
    });
    setError(null);
    setOpen(true);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload: PlanPayload = {
        ...form,
        start_date: form.start_date || null,
        end_date: form.end_date || null,
      };
      if (editing) await applicationsApi.plans.update(applicationId, editing.id, payload);
      else await applicationsApi.plans.create(applicationId, payload);
      await onChanged();
      setOpen(false);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Не удалось сохранить');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    setDeleteSaving(true);
    try {
      await applicationsApi.plans.remove(applicationId, deleting.id);
      setDeleting(null);
      await onChanged();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Не удалось удалить');
    } finally {
      setDeleteSaving(false);
    }
  };

  const columns: TableColumn<ProjectPlan>[] = [
    { key: 'event', header: 'Мероприятие', field: 'eventName' },
    { key: 'task', header: 'Задача', field: 'task' },
    { key: 'start', header: 'Начало', render: (p) => formatDateTime(p.startDate) },
    { key: 'end', header: 'Окончание', render: (p) => formatDateTime(p.endDate) },
    {
      key: 'actions',
      header: '',
      width: '100px',
      render: (p) => (
        <div className={styles.actions}>
          <Button size="sm" variant="ghost" icon="edit" aria-label="Изменить" onClick={() => startEdit(p)} />
          <Button size="sm" variant="ghost" icon="delete" aria-label="Удалить" onClick={() => setDeleting(p)} />
        </div>
      ),
    },
  ];

  return (
    <>
      <div className={styles.sectionToolbar}>
        <Button size="sm" icon="add" onClick={startCreate}>
          Добавить мероприятие
        </Button>
      </div>
      {plans.length === 0 ? (
        <StateMessage state="empty" message="План не заполнен" />
      ) : (
        <Table columns={columns} data={plans} rowKey={(p) => p.id} />
      )}

      <Modal open={open} title={editing ? 'Мероприятие' : 'Новое мероприятие'} onClose={() => setOpen(false)} width={480}>
        <form className={styles.form} onSubmit={handleSubmit}>
          <Input label="Мероприятие" value={form.event_name} onChange={(e) => setForm({ ...form, event_name: e.target.value })} required />
          <Input label="Задача" value={form.task} onChange={(e) => setForm({ ...form, task: e.target.value })} required />
          <Input
            label="Описание"
            value={form.event_description ?? ''}
            onChange={(e) => setForm({ ...form, event_description: e.target.value })}
          />
          <div className={styles.grid2}>
            <DatePicker label="Начало" value={form.start_date ?? ''} onChange={(value) => setForm({ ...form, start_date: value })} />
            <DatePicker label="Окончание" value={form.end_date ?? ''} onChange={(value) => setForm({ ...form, end_date: value })} />
          </div>
          {error ? <div className={styles.error}>{error}</div> : null}
          <div className={styles.formActions}>
            <Button variant="secondary" type="button" onClick={() => setOpen(false)} disabled={saving}>
              Отмена
            </Button>
            <Button type="submit" icon="check" loading={saving}>
              Сохранить
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={deleting !== null}
        title="Удаление мероприятия"
        message={`Удалить мероприятие «${deleting?.eventName ?? ''}»?`}
        confirmLabel="Удалить"
        danger
        loading={deleteSaving}
        onConfirm={() => void confirmDelete()}
        onClose={() => setDeleting(null)}
      />
    </>
  );
}
