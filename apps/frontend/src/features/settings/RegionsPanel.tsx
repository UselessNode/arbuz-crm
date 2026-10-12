// Панель «Регионы»: справочник с CRUD (замена хардкода субъектов РФ на данные).
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Button, Checkbox, ConfirmDialog, Container, Input, Modal, Pagination, SearchInput, StateMessage, Table, useToast } from '../../components/ui';
import type { TableColumn } from '../../components/ui';
import { regionsApi, type Region } from '../../api/site';
import { ApiError } from '../../api/client';
import styles from './SiteSettingsPage.module.css';

/** Варианты размера страницы в справочнике. */
const PAGE_SIZE_OPTIONS = [20, 50, 100] as const;

export function RegionsPanel() {
  const toast = useToast();
  const [regions, setRegions] = useState<Region[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(PAGE_SIZE_OPTIONS[0]);
  const [editing, setEditing] = useState<Region | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<Region | null>(null);
  const [deleteSaving, setDeleteSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await regionsApi.list();
      setRegions(response.regions);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Не удалось загрузить регионы');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const confirmDelete = async () => {
    if (!deleting) return;
    setDeleteSaving(true);
    try {
      await regionsApi.remove(deleting.id);
      setDeleting(null);
      await load();
      toast.showToast({ message: 'Регион удалён', tone: 'success' });
    } catch (caught) {
      toast.showToast({ message: caught instanceof ApiError ? caught.message : 'Не удалось удалить', tone: 'error' });
    } finally {
      setDeleteSaving(false);
    }
  };

  const columns: TableColumn<Region>[] = [
    { key: 'name', header: 'Название', field: 'name' },
    {
      key: 'default',
      header: 'По умолчанию',
      width: '150px',
      render: (region) => (region.isDefault ? 'Да' : '—'),
    },
    {
      key: 'actions',
      header: '',
      width: '110px',
      render: (region) => (
        <div className={styles.actions}>
          <Button size="sm" variant="ghost" icon="edit" aria-label="Изменить" onClick={() => setEditing(region)} />
          <Button size="sm" variant="ghost" icon="delete" aria-label="Удалить" onClick={() => setDeleting(region)} />
        </div>
      ),
    },
  ];

  // Поиск — клиентский (справочник небольшой), сбрасывает страницу на первую.
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return needle ? regions.filter((region) => region.name.toLowerCase().includes(needle)) : regions;
  }, [regions, query]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  return (
    <Container
      title="Регионы"
      actions={
        <Button size="sm" icon="add" onClick={() => setCreating(true)}>
          Добавить регион
        </Button>
      }
    >
      <p className={styles.hint}>
        Справочник регионов для форм регистрации и профиля. Регион «по умолчанию» подставляется в формах.
      </p>
      <div className={styles.toolbar}>
        <SearchInput
          onChange={(value) => {
            setQuery(value);
            setPage(1);
          }}
          placeholder="Поиск по названию"
        />
      </div>
      {loading ? (
        <StateMessage state="loading" />
      ) : error ? (
        <StateMessage state="error" message={error} onRetry={() => void load()} />
      ) : regions.length === 0 ? (
        <StateMessage state="empty" message="Регионы не добавлены" />
      ) : filtered.length === 0 ? (
        <StateMessage state="empty" message="Ничего не найдено" />
      ) : (
        <>
          <Table columns={columns} data={paged} rowKey={(region) => region.id} />
          <Pagination
            page={safePage}
            pageSize={pageSize}
            total={filtered.length}
            onPageChange={setPage}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setPage(1);
            }}
            pageSizeOptions={PAGE_SIZE_OPTIONS}
          />
        </>
      )}

      {creating ? <RegionModal onClose={() => setCreating(false)} onSaved={load} /> : null}
      {editing ? <RegionModal region={editing} onClose={() => setEditing(null)} onSaved={load} /> : null}

      <ConfirmDialog
        open={deleting !== null}
        title="Удаление региона"
        message={`Удалить регион «${deleting?.name ?? ''}»?`}
        confirmLabel="Удалить"
        danger
        loading={deleteSaving}
        onConfirm={() => void confirmDelete()}
        onClose={() => setDeleting(null)}
      />
    </Container>
  );
}

function RegionModal({ region, onClose, onSaved }: { region?: Region; onClose: () => void; onSaved: () => Promise<void> }) {
  const toast = useToast();
  const isEdit = Boolean(region);
  const [name, setName] = useState(region?.name ?? '');
  const [isDefault, setIsDefault] = useState(region?.isDefault ?? false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const payload = { name: name.trim(), is_default: isDefault };
      if (isEdit && region) await regionsApi.update(region.id, payload);
      else await regionsApi.create(payload);
      await onSaved();
      toast.showToast({ message: 'Регион сохранён', tone: 'success' });
      onClose();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Не удалось сохранить');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open title={isEdit ? 'Регион' : 'Новый регион'} onClose={onClose} width={440}>
      <form className={styles.form} onSubmit={handleSubmit}>
        <Input label="Название" value={name} onChange={(event) => setName(event.target.value)} required />
        <Checkbox
          checked={isDefault}
          onChange={setIsDefault}
          label="Регион по умолчанию (подставляется в формах)"
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
