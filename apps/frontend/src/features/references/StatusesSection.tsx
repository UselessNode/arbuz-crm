// Блок «Статусы заявок» в разделе «Настройки экспертизы».
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  Badge,
  Button,
  Checkbox,
  ConfirmDialog,
  Container,
  DataView,
  Input,
  Modal,
  useDataViewState,
  useToast,
} from '../../components/ui';
import type { TableColumn } from '../../components/ui';
import { statusesApi, type ApplicationStatus } from '../../api/references';
import { ApiError } from '../../api/client';
import { sortRows } from '../../lib/sort-rows';
import styles from './References.module.css';

function StatusFormModal({
  open,
  initial,
  onClose,
  onSaved,
}: {
  open: boolean;
  initial: ApplicationStatus | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const toast = useToast();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isEditable, setIsEditable] = useState(true);
  const [isDeletable, setIsDeletable] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(initial?.name ?? '');
    setDescription(initial?.description ?? '');
    setIsEditable(initial?.isEditable ?? true);
    setIsDeletable(initial?.isDeletable ?? true);
    setError(null);
  }, [open, initial]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const payload = { name: name.trim(), description: description.trim() || null, is_editable: isEditable, is_deletable: isDeletable };
      if (initial) await statusesApi.update(initial.id, payload);
      else await statusesApi.create(payload);
      await onSaved();
      toast.showToast({ message: 'Сохранено', tone: 'success' });
      onClose();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Не удалось сохранить');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} title={initial ? 'Редактировать статус' : 'Новый статус'} onClose={onClose} width={480}>
      <form className={styles.form} onSubmit={handleSubmit}>
        <Input label="Название" value={name} onChange={(e) => setName(e.target.value)} required />
        <Input label="Описание" value={description} onChange={(e) => setDescription(e.target.value)} />
        <Checkbox label="Заявку можно редактировать в этом статусе" checked={isEditable} onChange={setIsEditable} />
        <Checkbox label="Заявку можно удалить в этом статусе" checked={isDeletable} onChange={setIsDeletable} />
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

export function StatusesSection() {
  const toast = useToast();
  const [statuses, setStatuses] = useState<ApplicationStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<ApplicationStatus | null>(null);
  const [deleting, setDeleting] = useState<ApplicationStatus | null>(null);
  const [deleteSaving, setDeleteSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await statusesApi.list();
      setStatuses(response.statuses);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Не удалось загрузить статусы');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const state = useDataViewState({ specs: [], defaultPageSize: 50 });
  const { query } = state;

  // Справочник небольшой — поиск и сортировка на клиенте.
  const filtered = useMemo(() => {
    const needle = query.search.trim().toLowerCase();
    if (!needle) return statuses;
    return statuses.filter((status) => [status.name, status.description ?? ''].join(' ').toLowerCase().includes(needle));
  }, [statuses, query.search]);

  const sorted = useMemo(
    () =>
      sortRows(filtered, query.sort, (status, field) => {
        switch (field) {
          case 'name':
            return status.name.toLowerCase();
          case 'editable':
            return status.isEditable ? 1 : 0;
          case 'deletable':
            return status.isDeletable ? 1 : 0;
          case 'description':
            return status.description ?? '';
          default:
            return status.id;
        }
      }),
    [filtered, query.sort],
  );

  const handleDelete = async () => {
    if (!deleting) return;
    setDeleteSaving(true);
    try {
      await statusesApi.remove(deleting.id);
      setDeleting(null);
      await load();
      toast.showToast({ message: 'Удалено', tone: 'success' });
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Не удалось удалить статус');
    } finally {
      setDeleteSaving(false);
    }
  };

  const columns: TableColumn<ApplicationStatus>[] = [
    { key: 'name', header: 'Название', field: 'name' },
    {
      key: 'editable',
      header: 'Редактируемый',
      render: (s) => (s.isEditable ? <Badge tone="green">да</Badge> : <Badge tone="gray">нет</Badge>),
    },
    {
      key: 'deletable',
      header: 'Удаляемый',
      render: (s) => (s.isDeletable ? <Badge tone="green">да</Badge> : <Badge tone="gray">нет</Badge>),
    },
    { key: 'description', header: 'Описание', render: (s) => s.description ?? '—' },
    {
      key: 'actions',
      header: '',
      width: '100px',
      sortable: false,
      render: (s) => (
        <div className={styles.actions}>
          <Button size="sm" variant="ghost" icon="edit" aria-label="Изменить" onClick={() => setEditing(s)} />
          <Button size="sm" variant="ghost" icon="delete" aria-label="Удалить" onClick={() => setDeleting(s)} />
        </div>
      ),
    },
  ];

  return (
    <Container
      title="Статусы заявок"
      actions={
        <Button icon="add" onClick={() => setCreating(true)}>
          Добавить
        </Button>
      }
    >
      <DataView
        state={state}
        mode="pro"
        search={{ placeholder: 'Поиск по названию и описанию' }}
        columns={columns}
        rows={sorted}
        rowKey={(status) => status.id}
        total={sorted.length}
        paginated={false}
        loading={loading}
        error={error}
        onRetry={() => void load()}
        emptyText="Статусы не найдены"
        noResultsText="Ничего не найдено"
      />

      <StatusFormModal open={creating} initial={null} onClose={() => setCreating(false)} onSaved={load} />
      <StatusFormModal open={editing !== null} initial={editing} onClose={() => setEditing(null)} onSaved={load} />
      <ConfirmDialog
        open={deleting !== null}
        title="Удаление статуса"
        message={`Удалить статус «${deleting?.name ?? ''}»?`}
        confirmLabel="Удалить"
        danger
        loading={deleteSaving}
        onConfirm={() => void handleDelete()}
        onClose={() => setDeleting(null)}
      />
    </Container>
  );
}
