// Справочник «Конкурсы» + критерии оценивания и «опасная зона».
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  Button,
  ConfirmDialog,
  Container,
  Input,
  ListToolbar,
  Modal,
  NumberInput,
  SearchInput,
  StateMessage,
  Table,
  useToast,
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
  onExpertsCountChanged,
}: {
  open: boolean;
  initial: Tender | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
  onExpertsCountChanged?: (tender: Tender) => void;
}) {
  const toast = useToast();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [expertsCount, setExpertsCount] = useState(2);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(initial?.name ?? '');
    setDescription(initial?.description ?? '');
    setExpertsCount(initial?.expertsCount ?? 2);
    setError(null);
  }, [open, initial]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const payload = { name: name.trim(), description: description.trim() || null, experts_count: expertsCount };
      if (initial) {
        const response = await tendersApi.update(initial.id, payload);
        await onSaved();
        toast.showToast({ message: 'Конкурс сохранён', tone: 'success' });
        onClose();
        if (initial.expertsCount !== response.tender.expertsCount) onExpertsCountChanged?.(response.tender);
      } else {
        await tendersApi.create(payload);
        await onSaved();
        toast.showToast({ message: 'Конкурс создан', tone: 'success' });
        onClose();
      }
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Не удалось сохранить');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} title={initial ? 'Редактировать конкурс' : 'Новый конкурс'} onClose={onClose} width={480}>
      <form className={styles.form} onSubmit={handleSubmit}>
        <Input label="Название" value={name} onChange={(e) => setName(e.target.value)} required />
        <Input label="Описание" value={description} onChange={(e) => setDescription(e.target.value)} />
        <NumberInput
          label="Число экспертов на заявку"
          value={expertsCount}
          onChange={setExpertsCount}
          min={1}
          max={20}
          step={1}
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

/** «Опасная зона»: двойное предупреждение перед сбросом заявок конкурса. */
function TenderResetDialog({
  tender,
  reason,
  onClose,
  onDone,
}: {
  tender: Tender | null;
  reason: string;
  onClose: () => void;
  onDone: () => Promise<void>;
}) {
  const toast = useToast();
  const [step, setStep] = useState<1 | 2>(1);
  const [impact, setImpact] = useState<{ applications: number; reviews: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!tender) return;
    setStep(1);
    setError(null);
    setLoading(true);
    tendersApi
      .impact(tender.id)
      .then((response) => setImpact(response))
      .catch((caught) => setError(caught instanceof ApiError ? caught.message : 'Не удалось оценить последствия'))
      .finally(() => setLoading(false));
  }, [tender]);

  const handleReset = async () => {
    if (!tender) return;
    setResetting(true);
    setError(null);
    try {
      const result = await tendersApi.resetApplications(tender.id);
      await onDone();
      toast.showToast({
        message: `Сброшено: ${result.applications} заявок, ${result.reviews} экспертиз`,
        tone: 'success',
      });
      onClose();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Не удалось сбросить заявки');
    } finally {
      setResetting(false);
    }
  };

  return (
    <Modal open={tender !== null} title="Опасная зона: сброс заявок конкурса" onClose={onClose} width={520}>
      <div className={styles.danger}>
        <strong>Внимание!</strong> {reason}
      </div>

      {step === 1 ? (
        <>
          <p className={styles.dangerText}>
            Все заявки этого конкурса будут переведены в статус «Черновик», а назначенные экспертизы —
            сняты. Заявителям придётся отправить заявки повторно, экспертам — оценить их заново.
          </p>
          <p className={styles.dangerText}>Действие необратимо. Продолжить?</p>
          {error ? <div className={styles.error}>{error}</div> : null}
          <div className={styles.formActions}>
            <Button variant="secondary" onClick={onClose} disabled={resetting}>
              Отмена
            </Button>
            <Button variant="danger" icon="warning" disabled={loading} onClick={() => setStep(2)}>
              Продолжить
            </Button>
          </div>
        </>
      ) : (
        <>
          <p className={styles.dangerText}>Подтвердите повторно. Будет затронуто:</p>
          <p className={styles.dangerCounts}>
            {loading ? 'Подсчёт…' : `Заявок: ${impact?.applications ?? 0}, экспертиз: ${impact?.reviews ?? 0}`}
          </p>
          {error ? <div className={styles.error}>{error}</div> : null}
          <div className={styles.formActions}>
            <Button variant="secondary" onClick={() => setStep(1)} disabled={resetting}>
              Назад
            </Button>
            <Button variant="danger" icon="warning" loading={resetting} onClick={() => void handleReset()}>
              Сбросить заявки
            </Button>
          </div>
        </>
      )}
    </Modal>
  );
}

function CriteriaModal({
  tender,
  onClose,
  onSaved,
}: {
  tender: Tender | null;
  onClose: () => void;
  /** Сообщает родителю, что критерии изменились (без запуска «опасной зоны»). */
  onSaved: () => void;
}) {
  const toast = useToast();
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
      toast.showToast({ message: 'Критерий сохранён', tone: 'success' });
      onSaved();
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
      toast.showToast({ message: 'Критерий удалён', tone: 'success' });
      onSaved();
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
          <NumberInput label="Вес" value={weight} onChange={setWeight} min={0.5} step={0.5} />
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

interface TendersPageProps {
  /** Сообщает родителю (странице настроек) о создании/изменении/удалении конкурса:
   *  направления зависят от конкурсов и должны перечитать список. */
  onChanged?: () => void;
}

export function TendersPage({ onChanged }: TendersPageProps = {}) {
  const toast = useToast();
  const [tenders, setTenders] = useState<Tender[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Tender | null>(null);
  const [deleting, setDeleting] = useState<Tender | null>(null);
  const [deleteSaving, setDeleteSaving] = useState(false);
  const [criteriaFor, setCriteriaFor] = useState<Tender | null>(null);
  const [resetRequest, setResetRequest] = useState<{ tender: Tender; reason: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await tendersApi.list();
      setTenders(response.tenders);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Не удалось загрузить конкурсы');
    } finally {
      setLoading(false);
    }
  }, []);

  /** Перечитать список конкурсов и уведомить родителя (направления зависят от конкурсов). */
  const reload = useCallback(async () => {
    await load();
    onChanged?.();
  }, [load, onChanged]);

  useEffect(() => {
    void load();
  }, [load]);

  // Справочник небольшой — фильтруем на клиенте.
  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return tenders;
    return tenders.filter((tender) => [tender.name, tender.description ?? ''].join(' ').toLowerCase().includes(needle));
  }, [tenders, search]);

  const handleDelete = async () => {
    if (!deleting) return;
    setDeleteSaving(true);
    try {
      await tendersApi.remove(deleting.id);
      setDeleting(null);
      await reload();
      toast.showToast({ message: 'Конкурс удалён', tone: 'success' });
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Не удалось удалить конкурс');
    } finally {
      setDeleteSaving(false);
    }
  };

  const columns: TableColumn<Tender>[] = [
    { key: 'name', header: 'Название', field: 'name' },
    { key: 'description', header: 'Описание', render: (t) => t.description ?? '—' },
    { key: 'experts', header: 'Экспертов на заявку', width: '170px', render: (t) => t.expertsCount },
    {
      key: 'actions',
      header: '',
      width: '230px',
      render: (t) => (
        <div className={styles.actions}>
          <Button size="sm" variant="secondary" icon="settings" onClick={() => setCriteriaFor(t)}>
            Критерии
          </Button>
          <Button
            size="sm"
            variant="ghost"
            icon="warning"
            aria-label="Сбросить заявки конкурса"
            onClick={() => setResetRequest({ tender: t, reason: 'Сброс инициирован вручную.' })}
          />
          <Button size="sm" variant="ghost" icon="edit" aria-label="Изменить" onClick={() => setEditing(t)} />
          <Button size="sm" variant="ghost" icon="delete" aria-label="Удалить" onClick={() => setDeleting(t)} />
        </div>
      ),
    },
  ];

  return (
    <Container
      title="Конкурсы"
      actions={
        <Button icon="add" onClick={() => setCreating(true)}>
          Добавить
        </Button>
      }
    >
      <ListToolbar>
        <SearchInput placeholder="Поиск по названию и описанию" onChange={setSearch} />
      </ListToolbar>

      {loading ? (
        <StateMessage state="loading" />
      ) : error ? (
        <StateMessage state="error" message={error} onRetry={() => void load()} />
      ) : filtered.length === 0 ? (
        <StateMessage state="empty" message={tenders.length === 0 ? 'Конкурсы не найдены' : 'Ничего не найдено'} />
      ) : (
        <Table columns={columns} data={filtered} rowKey={(t) => t.id} />
      )}

      <TenderFormModal open={creating} initial={null} onClose={() => setCreating(false)} onSaved={reload} />
      <TenderFormModal
        open={editing !== null}
        initial={editing}
        onClose={() => setEditing(null)}
        onSaved={reload}
        onExpertsCountChanged={(tender) =>
          setResetRequest({ tender, reason: 'Изменено число экспертов на заявку.' })
        }
      />
      <CriteriaModal
        tender={criteriaFor}
        onClose={() => setCriteriaFor(null)}
        onSaved={() => {
          // Критерии не трогают заявки — «опасная зона» срабатывает только явно
          // (кнопка сброса в списке конкурсов или изменение числа экспертов).
          setCriteriaFor(null);
        }}
      />
      <TenderResetDialog
        tender={resetRequest?.tender ?? null}
        reason={resetRequest?.reason ?? ''}
        onClose={() => setResetRequest(null)}
        onDone={reload}
      />
      <ConfirmDialog
        open={deleting !== null}
        title="Удаление конкурса"
        message={`Удалить конкурс «${deleting?.name ?? ''}»?`}
        confirmLabel="Удалить"
        danger
        loading={deleteSaving}
        onConfirm={() => void handleDelete()}
        onClose={() => setDeleting(null)}
      />
    </Container>
  );
}
