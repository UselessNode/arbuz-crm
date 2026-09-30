// Секция «Команда проекта» в карточке заявки.
import { useState, type FormEvent } from 'react';
import { Badge, Button, Checkbox, ConfirmDialog, Input, Modal, StateMessage, Table, useToast } from '../../components/ui';
import type { TableColumn } from '../../components/ui';
import { applicationsApi, type TeamMember, type TeamMemberPayload } from '../../api/applications';
import { consentsApi } from '../../api/consents';
import { ApiError } from '../../api/client';
import { formatUserName } from '../../lib/format';
import { ConsentModal } from './ConsentModal';
import styles from './Applications.module.css';

interface Props {
  applicationId: number;
  members: TeamMember[];
  readOnly?: boolean;
  onChanged: () => Promise<void>;
}

const emptyForm = (): TeamMemberPayload => ({
  surname: '',
  name: '',
  patronymic: '',
  tasks_in_project: '',
  contact_info: '',
  social_media_links: '',
  forum_url: '',
  education: '',
  work_experience: '',
});

export function TeamMembersSection({ applicationId, members, readOnly = false, onChanged }: Props) {
  const toast = useToast();
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
      contact_info: member.contactInfo,
      social_media_links: member.socialMediaLinks,
      forum_url: member.forumUrl,
      education: member.education,
      work_experience: member.workExperience,
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
        // Поля, которые не показываются для этой роли, очищаем — иначе они останутся невидимыми.
        forum_url: isResponsible ? form.forum_url : null,
        education: isCoordinator ? form.education : null,
        is_responsible: isResponsible,
        is_coordinator: isCoordinator,
        is_adult: isAdult,
      };
      if (editing) await applicationsApi.teamMembers.update(applicationId, editing.id, payload);
      else await applicationsApi.teamMembers.create(applicationId, payload);
      await onChanged();
      toast.showToast({ message: 'Участник сохранён', tone: 'success' });
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
      toast.showToast({ message: 'Участник удалён', tone: 'success' });
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
      render: (m) =>
        [m.isResponsible ? 'ответственный за форум' : null, m.isCoordinator ? 'координатор' : null]
          .filter(Boolean)
          .join(', ') || '—',
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
      width: readOnly ? '60px' : '140px',
      render: (m) => (
        <div className={styles.actions}>
          <Button size="sm" variant="ghost" icon="document" aria-label="Согласия" onClick={() => setConsentMember(m)} />
          {!readOnly ? (
            <>
              <Button size="sm" variant="ghost" icon="edit" aria-label="Изменить" onClick={() => startEdit(m)} />
              <Button size="sm" variant="ghost" icon="delete" aria-label="Удалить" onClick={() => setDeleting(m)} />
            </>
          ) : null}
        </div>
      ),
    },
  ];

  return (
    <>
      {!readOnly ? (
        <div className={styles.sectionToolbar}>
          <Button size="sm" icon="add" onClick={startCreate}>
            Добавить участника
          </Button>
        </div>
      ) : null}
      {members.length === 0 ? (
        <StateMessage state="empty" message="Участники не добавлены" />
      ) : (
        <Table columns={columns} data={members} rowKey={(m) => m.id} />
      )}

      <Modal open={open} title={editing ? 'Участник команды' : 'Новый участник'} onClose={() => setOpen(false)} width={560}>
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
          <div className={styles.grid2}>
            <Input
              label="Контактные данные"
              value={form.contact_info ?? ''}
              onChange={(e) => setForm({ ...form, contact_info: e.target.value })}
              placeholder="Телефон или email"
            />
            <Input
              label="Ссылка на соцсеть"
              value={form.social_media_links ?? ''}
              onChange={(e) => setForm({ ...form, social_media_links: e.target.value })}
              placeholder="https://"
            />
          </div>
          <div className={styles.grid2}>
            <Input
              label="Опыт работы с проектами"
              value={form.work_experience ?? ''}
              onChange={(e) => setForm({ ...form, work_experience: e.target.value })}
            />
            {/* Образование заполняет только координатор проекта. */}
            {isCoordinator ? (
              <Input
                label="Образование"
                value={form.education ?? ''}
                onChange={(e) => setForm({ ...form, education: e.target.value })}
              />
            ) : null}
          </div>
          {/* Профиль на форуме заполняет только ответственный за форум. */}
          {isResponsible ? (
            <Input
              label="Ссылка на профиль на форуме"
              value={form.forum_url ?? ''}
              onChange={(e) => setForm({ ...form, forum_url: e.target.value })}
              placeholder="https://"
            />
          ) : null}
          <Checkbox label="Ответственный за форум" checked={isResponsible} onChange={setIsResponsible} />
          <Checkbox label="Координатор" checked={isCoordinator} onChange={setIsCoordinator} />
          <Checkbox label="Совершеннолетний" checked={isAdult} onChange={setIsAdult} />
          <div className={styles.sectionToolbar}>
            <span className={styles.metaLabel}>Образец согласия ПДн:</span>
            <Button
              size="sm"
              variant="secondary"
              icon="download"
              onClick={() => window.open(consentsApi.templates.downloadUrl('minor'), '_blank', 'noopener')}
            >
              до 14 лет
            </Button>
            <Button
              size="sm"
              variant="secondary"
              icon="download"
              onClick={() => window.open(consentsApi.templates.downloadUrl('adult'), '_blank', 'noopener')}
            >
             с 14 лет
            </Button>
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
          readOnly={readOnly}
          onClose={() => setConsentMember(null)}
          onChanged={onChanged}
        />
      ) : null}
    </>
  );
}
