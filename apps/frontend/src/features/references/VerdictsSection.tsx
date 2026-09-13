// Блок «Вердикты рецензий» в разделе «Настройки экспертизы».
// Вердикт — редактируемый справочник: администратор задаёт названия и цвета,
// один вердикт помечается «по умолчанию» (его получает новая рецензия).
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import {
  Badge,
  Button,
  Checkbox,
  ConfirmDialog,
  Container,
  Input,
  Modal,
  Select,
  StateMessage,
  Table,
  toBadgeTone,
  useToast,
} from '../../components/ui';
import type { SelectOption, TableColumn } from '../../components/ui';
import { reviewStatusesApi, type ReviewVerdict, type ReviewVerdictPayload } from '../../api/references';
import { ApiError } from '../../api/client';
import styles from './References.module.css';

/** Варианты цвета бейджа для формы (значения совпадают с тонами дизайн-системы). */
const TONE_OPTIONS: readonly SelectOption<string>[] = [
  { value: 'gray', label: 'Серый' },
  { value: 'green', label: 'Зелёный' },
  { value: 'red', label: 'Красный' },
  { value: 'yellow', label: 'Жёлтый' },
  { value: 'blue', label: 'Синий' },
  { value: 'purple', label: 'Фиолетовый' },
  { value: 'neutral', label: 'Нейтральный' },
];

function VerdictFormModal({
  open,
  initial,
  onClose,
  onSaved,
}: {
  open: boolean;
  initial: ReviewVerdict | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const toast = useToast();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [tone, setTone] = useState('gray');
  const [isDefault, setIsDefault] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(initial?.name ?? '');
    setDescription(initial?.description ?? '');
    setTone(initial?.tone ?? 'gray');
    setIsDefault(initial?.isDefault ?? false);
    setError(null);
  }, [open, initial]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const payload: ReviewVerdictPayload = {
        name: name.trim(),
        description: description.trim() || null,
        tone,
        is_default: isDefault,
      };
      if (initial) await reviewStatusesApi.update(initial.id, payload);
      else await reviewStatusesApi.create(payload);
      await onSaved();
      toast.showToast({ message: 'Вердикт сохранён', tone: 'success' });
      onClose();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Не удалось сохранить вердикт');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} title={initial ? 'Редактировать вердикт' : 'Новый вердикт'} onClose={onClose} width={480}>
      <form className={styles.form} onSubmit={handleSubmit}>
        <Input label="Название" value={name} onChange={(e) => setName(e.target.value)} required />
        <Input label="Описание" value={description} onChange={(e) => setDescription(e.target.value)} />
        <Select label="Цвет бейджа" value={tone} onChange={setTone} options={TONE_OPTIONS} />
        <Checkbox
          label="Вердикт по умолчанию (выставляется новой рецензии)"
          checked={isDefault}
          onChange={setIsDefault}
          disabled={initial?.isDefault}
        />
        {initial?.isDefault ? (
          <span className={styles.hint}>
            Это текущий вердикт по умолчанию: чтобы сменить, назначьте «по умолчанию» другой вердикт.
          </span>
        ) : null}
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

export function VerdictsSection() {
  const toast = useToast();
  const [verdicts, setVerdicts] = useState<ReviewVerdict[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<ReviewVerdict | null>(null);
  const [deleting, setDeleting] = useState<ReviewVerdict | null>(null);
  const [deleteSaving, setDeleteSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await reviewStatusesApi.list();
      setVerdicts(response.statuses);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Не удалось загрузить вердикты');
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
    setError(null);
    try {
      await reviewStatusesApi.remove(deleting.id);
      setDeleting(null);
      await load();
      toast.showToast({ message: 'Вердикт удалён', tone: 'success' });
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Не удалось удалить вердикт');
    } finally {
      setDeleteSaving(false);
    }
  };

  const columns: TableColumn<ReviewVerdict>[] = [
    { key: 'name', header: 'Вердикт', render: (v) => <Badge tone={toBadgeTone(v.tone)}>{v.name}</Badge> },
    {
      key: 'default',
      header: 'По умолчанию',
      render: (v) => (v.isDefault ? <Badge tone="green">да</Badge> : <Badge tone="gray">нет</Badge>),
    },
    { key: 'description', header: 'Описание', render: (v) => v.description ?? '—' },
    {
      key: 'actions',
      header: '',
      width: '100px',
      render: (v) => (
        <div className={styles.actions}>
          <Button size="sm" variant="ghost" icon="edit" aria-label="Изменить" onClick={() => setEditing(v)} />
          <Button size="sm" variant="ghost" icon="delete" aria-label="Удалить" onClick={() => setDeleting(v)} disabled={v.isDefault} />
        </div>
      ),
    },
  ];

  return (
    <Container
      title="Вердикты рецензий"
      actions={
        <Button icon="add" onClick={() => setCreating(true)}>
          Добавить
        </Button>
      }
    >
      <div className={styles.hint}>
        Вердикт — рекомендация эксперта. Финальный статус заявки всё равно ставит администратор.
      </div>

      {loading ? (
        <StateMessage state="loading" />
      ) : error ? (
        <StateMessage state="error" message={error} onRetry={() => void load()} />
      ) : verdicts.length === 0 ? (
        <StateMessage state="empty" message="Вердикты не настроены" />
      ) : (
        <Table columns={columns} data={verdicts} rowKey={(v) => v.id} />
      )}

      <VerdictFormModal open={creating} initial={null} onClose={() => setCreating(false)} onSaved={load} />
      <VerdictFormModal open={editing !== null} initial={editing} onClose={() => setEditing(null)} onSaved={load} />
      <ConfirmDialog
        open={deleting !== null}
        title="Удаление вердикта"
        message={`Удалить вердикт «${deleting?.name ?? ''}»?`}
        confirmLabel="Удалить"
        danger
        loading={deleteSaving}
        onConfirm={() => void handleDelete()}
        onClose={() => setDeleting(null)}
      />
    </Container>
  );
}
