// Справочник «Тендеры» (конкурсы) + критерии оценивания.
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import {
  Button,
  ConfirmDialog,
  Container,
  Input,
  Modal,
  NumberInput,
  StateMessage,
  Table,
} from '../../components/ui';
import type { TableColumn } from '../../components/ui';
import { criteriaApi, tendersApi, type Criterion, type Tender } from '../../api/references';
import { ApiError } from '../../api/client';
import styles from './References.module.css';

function TenderFormModal({
  open,
  initial,
  onClose,
  onSaved,
}: {
  open: boolean;
  initial: Tender | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(initial?.name ?? '');
    setDescription(initial?.description ?? '');
    setError(null);
  }, [open, initial]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const payload = { name: name.trim(), description: description.trim() || null };
      if (initial) await tendersApi.update(initial.id, payload);
      else await tendersApi.create(payload);
      await onSaved();
      onClose();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Не удалось сохранить');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} title={initial ? 'Редактировать тендер' : 'Новый тендер'} onClose={onClose} width={480}>
      <form className={styles.form} onSubmit={handleSubmit}>
        <Input label="Название" value={name} onChange={(e) => setName(e.target.value)} required />
        <Input label="Описание" value={description} onChange={(e) => setDescription(e.target.value)} />
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

function CriteriaModal({ tender, onClose }: { tender: Tender | null; onClose: () => void }) {
  const [criteria, setCriteria] = useState<Criterion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Criterion | null>(null);
  const [name, setName] = useState('');
  const [minValue, setMinValue] = useState(0);
  const [maxValue, setMaxValue] = useState(10);
  const [weight, setWeight] = useState(1);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!tender) return;
    setLoading(true);
    setError(null);
    try {
      const response = await criteriaApi.list(tender.id);
      setCriteria(response.criteria);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Не удалось загрузить критерии');
    } finally {
      setLoading(false);
    }
  }, [tender]);

  useEffect(() => {
    void load();
  }, [load]);

  const resetForm = () => {
    setEditing(null);
    setName('');
    setMinValue(0);
    setMaxValue(10);
    setWeight(1);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!tender) return;
    setSaving(true);
    setError(null);
    try {
      const payload = { name: name.trim(), min_value: minValue, max_value: maxValue, weight };
      if (editing) await criteriaApi.update(tender.id, editing.id, payload);
      else await criteriaApi.create(tender.id, payload);
      resetForm();
      await load();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Не удалось сохранить критерий');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (criterion: Criterion) => {
    if (!tender) return;
    try {
      await criteriaApi.remove(tender.id, criterion.id);
      await load();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Не удалось удалить критерий');
    }
  };

  const startEdit = (criterion: Criterion) => {
    setEditing(criterion);
    setName(criterion.name);
    setMinValue(criterion.minValue);
    setMaxValue(criterion.maxValue);
    setWeight(criterion.weight);
  };

  return (
    <Modal open={tender !== null} title={`Критерии — ${tender?.name ?? ''}`} onClose={onClose} width={720}>
      {error ? <div className={styles.error}>{error}</div> : null}

      {loading ? (
        <StateMessage state="loading" />
      ) : criteria.length === 0 ? (
        <StateMessage state="empty" message="Критериев пока нет" />
      ) : (
        <Table
          columns={[
            { key: 'name', header: 'Критерий', field: 'name' },
            { key: 'min', header: 'Мин', render: (c) => c.minValue },
            { key: 'max', header: 'Макс', render: (c) => c.maxValue },
            { key: 'weight', header: 'Вес', render: (c) => c.weight },
            {
              key: 'actions',
              header: '',
              width: '110px',
              render: (c) => (
                <div className={styles.actions}>
                  <Button size="sm" variant="ghost" icon="edit" aria-label="Изменить" onClick={() => startEdit(c)} />
                  <Button size="sm" variant="ghost" icon="delete" aria-label="Удалить" onClick={() => void handleDelete(c)} />
                </div>
              ),
            },
          ]}
          data={criteria}
          rowKey={(c) => c.id}
        />
      )}

      <form className={`${styles.form} ${styles.sectionGap}`} onSubmit={handleSubmit}>
        <div className={styles.grid2}>
          <Input label="Название критерия" value={name} onChange={(e) => setName(e.target.value)} required />
          <NumberInput label="Вес" value={weight} onChange={setWeight} min={0} step={0.5} />
        </div>
        <div className={styles.grid2}>
          <NumberInput label="Мин. значение" value={minValue} onChange={setMinValue} step={1} />
          <NumberInput label="Макс. значение" value={maxValue} onChange={setMaxValue} step={1} />
        </div>
        <div className={styles.formActions}>
          {editing ? (
            <Button variant="secondary" type="button" onClick={resetForm} disabled={saving}>
              Отменить правку
            </Button>
          ) : null}
          <Button type="submit" icon="add" loading={saving}>
            {editing ? 'Сохранить критерий' : 'Добавить критерий'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export function TendersPage() {
  const [tenders, setTenders] = useState<Tender[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Tender | null>(null);
  const [deleting, setDeleting] = useState<Tender | null>(null);
  const [deleteSaving, setDeleteSaving] = useState(false);
  const [criteriaFor, setCriteriaFor] = useState<Tender | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await tendersApi.list();
      setTenders(response.tenders);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Не удалось загрузить тендеры');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleDelete = async () => {
    if (!deleting) return;
    setDeleteSaving(true);
    try {
      await tendersApi.remove(deleting.id);
      setDeleting(null);
      await load();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Не удалось удалить тендер');
    } finally {
      setDeleteSaving(false);
    }
  };

  const columns: TableColumn<Tender>[] = [
    { key: 'name', header: 'Название', field: 'name' },
    { key: 'description', header: 'Описание', render: (t) => t.description ?? '—' },
    {
      key: 'actions',
      header: '',
      width: '150px',
      render: (t) => (
        <div className={styles.actions}>
          <Button size="sm" variant="secondary" icon="settings" onClick={() => setCriteriaFor(t)}>
            Критерии
          </Button>
          <Button size="sm" variant="ghost" icon="edit" aria-label="Изменить" onClick={() => setEditing(t)} />
          <Button size="sm" variant="ghost" icon="delete" aria-label="Удалить" onClick={() => setDeleting(t)} />
        </div>
      ),
    },
  ];

  return (
    <Container
      title="Тендеры (конкурсы)"
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
      ) : tenders.length === 0 ? (
        <StateMessage state="empty" message="Тендеры не найдены" />
      ) : (
        <Table columns={columns} data={tenders} rowKey={(t) => t.id} />
      )}

      <TenderFormModal open={creating} initial={null} onClose={() => setCreating(false)} onSaved={load} />
      <TenderFormModal open={editing !== null} initial={editing} onClose={() => setEditing(null)} onSaved={load} />
      <CriteriaModal tender={criteriaFor} onClose={() => setCriteriaFor(null)} />
      <ConfirmDialog
        open={deleting !== null}
        title="Удаление тендера"
        message={`Удалить тендер «${deleting?.name ?? ''}»?`}
        confirmLabel="Удалить"
        danger
        loading={deleteSaving}
        onConfirm={() => void handleDelete()}
        onClose={() => setDeleting(null)}
      />
    </Container>
  );
}
