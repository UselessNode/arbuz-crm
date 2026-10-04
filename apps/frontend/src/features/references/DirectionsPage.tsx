// Справочник «Направления».
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  Button,
  ConfirmDialog,
  Container,
  DataView,
  Input,
  Modal,
  Select,
  useDataViewState,
  useToast,
} from '../../components/ui';
import type { DateRangeValue, FilterSpec, SelectOption, TableColumn } from '../../components/ui';
import { directionsApi, tendersApi, type Direction, type Tender } from '../../api/references';
import { ApiError } from '../../api/client';
import { formatDateTime } from '../../lib/format';
import { sortRows } from '../../lib/sort-rows';
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
  const toast = useToast();
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
      toast.showToast({ message: 'Сохранено', tone: 'success' });
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
          label="Конкурс"
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

interface DirectionsPageProps {
  /** Меняется при создании/правке конкурса: направления перечитывают список и селект конкурсов. */
  refreshToken?: number;
}

export function DirectionsPage({ refreshToken = 0 }: DirectionsPageProps = {}) {
  const toast = useToast();
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
    // refreshToken меняется при добавлении/правке конкурса — тогда список перечитывается.
  }, [refreshToken]);

  useEffect(() => {
    void load();
  }, [load]);

  const tenderName = useMemo(() => {
    const map = new Map(tenders.map((tender) => [tender.id, tender.name]));
    return (id: number | null) => (id ? map.get(id) ?? '—' : '—');
  }, [tenders]);

  const specs = useMemo<FilterSpec[]>(
    () => [
      {
        kind: 'multi-select',
        field: 'name',
        label: 'По названию',
        placeholder: 'Название направления…',
        loadOptions: async (search) => {
          const needle = search.trim().toLowerCase();
          return directions
            .filter((direction) => !needle || direction.name.toLowerCase().includes(needle))
            .map((direction) => ({ value: String(direction.id), label: direction.name }));
        },
      },
      {
        kind: 'multi-select',
        field: 'tender',
        label: 'По конкурсу',
        placeholder: 'Название конкурса…',
        loadOptions: async (search) => {
          const needle = search.trim().toLowerCase();
          const options = tenders
            .filter((tender) => !needle || tender.name.toLowerCase().includes(needle))
            .map((tender) => ({ value: String(tender.id), label: tender.name }));
          return [{ value: 'none', label: 'Без привязки' }, ...options];
        },
      },
      { kind: 'date-range', field: 'created', label: 'Дата создания', presets: true },
      { kind: 'date-range', field: 'updated', label: 'Дата изменения', presets: true },
    ],
    [directions, tenders],
  );

  const state = useDataViewState({ specs, defaultPageSize: 50 });
  const { query } = state;

  // Справочник небольшой — фильтруем на клиенте по состоянию DataView.
  const filtered = useMemo(() => {
    const needle = query.search.trim().toLowerCase();
    const names = (query.filters.name as string[] | undefined) ?? [];
    const tenderIds = (query.filters.tender as string[] | undefined) ?? [];
    const created = query.filters.created as DateRangeValue | undefined;
    const updated = query.filters.updated as DateRangeValue | undefined;
    return directions.filter((direction) => {
      if (needle && ![direction.name, direction.description ?? ''].join(' ').toLowerCase().includes(needle)) return false;
      if (names.length && !names.includes(String(direction.id))) return false;
      if (tenderIds.length) {
        const matchesNone = tenderIds.includes('none') && direction.tenderId === null;
        const matchesId = direction.tenderId !== null && tenderIds.includes(String(direction.tenderId));
        if (!matchesNone && !matchesId) return false;
      }
      const createdDay = direction.createdAt.slice(0, 10);
      if (created?.from && createdDay < created.from) return false;
      if (created?.to && createdDay > created.to) return false;
      const updatedDay = direction.updatedAt.slice(0, 10);
      if (updated?.from && updatedDay < updated.from) return false;
      if (updated?.to && updatedDay > updated.to) return false;
      return true;
    });
  }, [directions, query]);

  const sorted = useMemo(
    () =>
      sortRows(filtered, query.sort, (direction, field) => {
        switch (field) {
          case 'name':
            return direction.name.toLowerCase();
          case 'tender':
            return tenderName(direction.tenderId).toLowerCase();
          case 'description':
            return direction.description ?? '';
          case 'created_at':
            return direction.createdAt;
          case 'updated_at':
            return direction.updatedAt;
          default:
            return direction.id;
        }
      }),
    [filtered, query.sort, tenderName],
  );

  const handleDelete = async () => {
    if (!deleting) return;
    setDeleteSaving(true);
    try {
      await directionsApi.remove(deleting.id);
      setDeleting(null);
      await load();
      toast.showToast({ message: 'Удалено', tone: 'success' });
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Не удалось удалить направление');
    } finally {
      setDeleteSaving(false);
    }
  };

  const columns: TableColumn<Direction>[] = [
    { key: 'name', header: 'Название', field: 'name' },
    { key: 'tender', header: 'Конкурс', render: (direction) => tenderName(direction.tenderId) },
    { key: 'description', header: 'Описание', render: (direction) => direction.description ?? '—' },
    { key: 'updated_at', header: 'Изменён', render: (direction) => formatDateTime(direction.updatedAt) },
    {
      key: 'actions',
      header: '',
      width: '100px',
      sortable: false,
      render: (direction) => (
        <div className={styles.actions}>
          <Button size="sm" variant="ghost" icon="edit" aria-label="Изменить" onClick={() => setEditing(direction)} />
          <Button size="sm" variant="ghost" icon="delete" aria-label="Удалить" onClick={() => setDeleting(direction)} />
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
      <DataView
        state={state}
        mode="advanced"
        search={{ placeholder: 'Поиск по названию и описанию' }}
        columns={columns}
        rows={sorted}
        rowKey={(direction) => direction.id}
        total={sorted.length}
        paginated={false}
        loading={loading}
        error={error}
        onRetry={() => void load()}
        emptyText="Направления не найдены"
        noResultsText="Ничего не найдено"
      />

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
