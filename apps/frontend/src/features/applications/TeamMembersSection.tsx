// Секция «Команда проекта» в карточке заявки.
import { useState, type FormEvent } from 'react';
import { Badge, Button, Checkbox, ConfirmDialog, Input, Modal, StateMessage, Table } from '../../components/ui';
import type { TableColumn } from '../../components/ui';
import { applicationsApi, type TeamMember, type TeamMemberPayload } from '../../api/applications';
import { ApiError } from '../../api/client';
import { formatUserName } from '../../lib/format';
import { ConsentModal } from './ConsentModal';
import styles from './Applications.module.css';

interface Props {
  applicationId: number;
  members: TeamMember[];
  onChanged: () => Promise<void>;
}

const emptyForm = (): TeamMemberPayload => ({ surname: '', name: '', patronymic: '', tasks_in_project: '' });

export function TeamMembersSection({ applicationId, members, onChanged }: Props) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<TeamMember | null>(null);
  const [form, setForm] = useState<TeamMemberPayload>(emptyForm());
  const [isResponsible, setIsResponsible] = useState(false);
  const [isCoordinator, setIsCoordinator] = useState(false);
  const [isAdult, setIsAdult] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<TeamMember | null>(null);
  const [deleteSaving, setDeleteSaving] = useState(false);
  const [consentMember, setConsentMember] = useState<TeamMember | null>(null);

  const startCreate = () => {
    setEditing(null);
    setForm(emptyForm());
    setIsResponsible(false);
    setIsCoordinator(false);
    setIsAdult(true);
    setError(null);
    setOpen(true);
  };

  const startEdit = (member: TeamMember) => {
    setEditing(member);
    setForm({
      surname: member.surname,
      name: member.name,
      patronymic: member.patronymic,
      tasks_in_project: member.tasksInProject,
    });
    setIsResponsible(Boolean(member.isResponsible));
    setIsCoordinator(Boolean(member.isCoordinator));
    setIsAdult(member.isAdult ?? true);
    setError(null);
    setOpen(true);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload: TeamMemberPayload = {
        ...form,
        is_responsible: isResponsible,
        is_coordinator: isCoordinator,
        is_adult: isAdult,
      };
      if (editing) await applicationsApi.teamMembers.update(applicationId, editing.id, payload);
      else await applicationsApi.teamMembers.create(applicationId, payload);
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
      await applicationsApi.teamMembers.remove(applicationId, deleting.id);
      setDeleting(null);
      await onChanged();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Не удалось удалить');
    } finally {
      setDeleteSaving(false);
    }
  };

  const columns: TableColumn<TeamMember>[] = [
    { key: 'name', header: 'ФИО', render: (m) => formatUserName({ surname: m.surname, name: m.name, patronymic: m.patronymic }) },
    { key: 'tasks', header: 'Задачи', render: (m) => m.tasksInProject ?? '—' },
    {
      key: 'flags',
      header: 'Роли',
      render: (m) => [m.isResponsible ? 'ответственный' : null, m.isCoordinator ? 'координатор' : null].filter(Boolean).join(', ') || '—',
    },
    {
      key: 'consent',
      header: 'Согласие',
      render: (m) =>
        m.hasConsent ? (
          <Badge tone="green" icon="check">
            есть
          </Badge>
        ) : (
          <Badge tone="red" icon="warning">
            нет
          </Badge>
        ),
    },
    {
      key: 'actions',
      header: '',
      width: '140px',
      render: (m) => (
        <div className={styles.actions}>
          <Button size="sm" variant="ghost" icon="document" aria-label="Согласия" onClick={() => setConsentMember(m)} />
          <Button size="sm" variant="ghost" icon="edit" aria-label="Изменить" onClick={() => startEdit(m)} />
          <Button size="sm" variant="ghost" icon="delete" aria-label="Удалить" onClick={() => setDeleting(m)} />
        </div>
      ),
    },
  ];

  return (
    <>
      <div className={styles.sectionToolbar}>
        <Button size="sm" icon="add" onClick={startCreate}>
          Добавить участника
        </Button>
      </div>
      {members.length === 0 ? (
        <StateMessage state="empty" message="Участники не добавлены" />
      ) : (
        <Table columns={columns} data={members} rowKey={(m) => m.id} />
      )}

      <Modal open={open} title={editing ? 'Участник команды' : 'Новый участник'} onClose={() => setOpen(false)} width={480}>
        <form className={styles.form} onSubmit={handleSubmit}>
          <div className={styles.grid2}>
            <Input label="Фамилия" value={form.surname} onChange={(e) => setForm({ ...form, surname: e.target.value })} required />
            <Input label="Имя" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </div>
          <Input label="Отчество" value={form.patronymic ?? ''} onChange={(e) => setForm({ ...form, patronymic: e.target.value })} />
          <Input
            label="Задачи в проекте"
            value={form.tasks_in_project ?? ''}
            onChange={(e) => setForm({ ...form, tasks_in_project: e.target.value })}
          />
          <Checkbox label="Ответственный" checked={isResponsible} onChange={setIsResponsible} />
          <Checkbox label="Координатор" checked={isCoordinator} onChange={setIsCoordinator} />
          <Checkbox label="Совершеннолетний" checked={isAdult} onChange={setIsAdult} />
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
        title="Удаление участника"
        message="Удалить участника команды?"
        confirmLabel="Удалить"
        danger
        loading={deleteSaving}
        onConfirm={() => void confirmDelete()}
        onClose={() => setDeleting(null)}
      />

      {consentMember ? (
        <ConsentModal
          applicationId={applicationId}
          member={consentMember}
          onClose={() => setConsentMember(null)}
          onChanged={onChanged}
        />
      ) : null}
    </>
  );
}
