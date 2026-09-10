// Справочник «Направления».
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Button, ConfirmDialog, Container, Input, Modal, Select, StateMessage, Table } from '../../components/ui';
import type { SelectOption, TableColumn } from '../../components/ui';
import { directionsApi, tendersApi, type Direction, type Tender } from '../../api/references';
import { ApiError } from '../../api/client';
import styles from './References.module.css';

function DirectionFormModal({
  open,
  initial,
  tenders,
  onClose,
  onSaved,
}: {
  open: boolean;
  initial: Direction | null;
  tenders: Tender[];
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [tenderId, setTenderId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(initial?.name ?? '');
    setDescription(initial?.description ?? '');
    setTenderId(initial?.tenderId ? String(initial.tenderId) : '');
    setError(null);
  }, [open, initial]);

  const tenderOptions: readonly SelectOption<string>[] = tenders.map((tender) => ({
    value: String(tender.id),
    label: tender.name,
  }));

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        description: description.trim() || null,
        tender_id: tenderId ? Number(tenderId) : null,
      };
      if (initial) await directionsApi.update(initial.id, payload);
      else await directionsApi.create(payload);
      await onSaved();
      onClose();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Не удалось сохранить');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} title={initial ? 'Редактировать направление' : 'Новое направление'} onClose={onClose} width={480}>
      <form className={styles.form} onSubmit={handleSubmit}>
        <Input label="Название" value={name} onChange={(e) => setName(e.target.value)} required />
        <Input label="Описание" value={description} onChange={(e) => setDescription(e.target.value)} />
        <Select
          label="Тендер"
          placeholder="Без привязки"
          value={tenderId}
          onChange={setTenderId}
          options={tenderOptions}
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

export function DirectionsPage() {
  const [directions, setDirections] = useState<Direction[]>([]);
  const [tenders, setTenders] = useState<Tender[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Direction | null>(null);
  const [deleting, setDeleting] = useState<Direction | null>(null);
  const [deleteSaving, setDeleteSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [directionsResponse, tendersResponse] = await Promise.all([directionsApi.list(), tendersApi.list()]);
      setDirections(directionsResponse.directions);
      setTenders(tendersResponse.tenders);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Не удалось загрузить направления');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const tenderName = useMemo(() => {
    const map = new Map(tenders.map((tender) => [tender.id, tender.name]));
    return (id: number | null) => (id ? map.get(id) ?? '—' : '—');
  }, [tenders]);

  const handleDelete = async () => {
    if (!deleting) return;
    setDeleteSaving(true);
    try {
      await directionsApi.remove(deleting.id);
      setDeleting(null);
      await load();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Не удалось удалить направление');
    } finally {
      setDeleteSaving(false);
    }
  };

  const columns: TableColumn<Direction>[] = [
    { key: 'name', header: 'Название', field: 'name' },
    { key: 'tender', header: 'Тендер', render: (d) => tenderName(d.tenderId) },
    { key: 'description', header: 'Описание', render: (d) => d.description ?? '—' },
    {
      key: 'actions',
      header: '',
      width: '100px',
      render: (d) => (
        <div className={styles.actions}>
          <Button size="sm" variant="ghost" icon="edit" aria-label="Изменить" onClick={() => setEditing(d)} />
          <Button size="sm" variant="ghost" icon="delete" aria-label="Удалить" onClick={() => setDeleting(d)} />
        </div>
      ),
    },
  ];

  return (
    <Container
      title="Направления"
      actions={
        <Button icon="add" onClick={() => setCreating(true)}>
          Добавить
        </Button>
      }
    >
      {loading ? (
        <StateMessage state="loading" />
      ) : error ? (
        <StateMessage state="error" message={error} onRetry={() => void load()} />
      ) : directions.length === 0 ? (
        <StateMessage state="empty" message="Направления не найдены" />
      ) : (
        <Table columns={columns} data={directions} rowKey={(d) => d.id} />
      )}

      <DirectionFormModal open={creating} initial={null} tenders={tenders} onClose={() => setCreating(false)} onSaved={load} />
      <DirectionFormModal open={editing !== null} initial={editing} tenders={tenders} onClose={() => setEditing(null)} onSaved={load} />
      <ConfirmDialog
        open={deleting !== null}
        title="Удаление направления"
        message={`Удалить направление «${deleting?.name ?? ''}»?`}
        confirmLabel="Удалить"
        danger
        loading={deleteSaving}
        onConfirm={() => void handleDelete()}
        onClose={() => setDeleting(null)}
      />
    </Container>
  );
}
