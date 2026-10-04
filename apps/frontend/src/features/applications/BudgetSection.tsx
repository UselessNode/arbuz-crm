// Секция «Бюджет проекта» в карточке заявки.
import { useState, type FormEvent } from 'react';
import { Button, ConfirmDialog, Input, Modal, NumberInput, StateMessage, Table } from '../../components/ui';
import type { TableColumn } from '../../components/ui';
import { applicationsApi, type BudgetItem, type BudgetPayload } from '../../api/applications';
import { ApiError } from '../../api/client';
import { budgetMismatch, budgetMismatchText, formatMoney as money, itemCost, itemTotal, sumBy } from '../../lib/budget';
import styles from './Applications.module.css';

interface Props {
  applicationId: number;
  items: BudgetItem[];
  readOnly?: boolean;
  onChanged: () => Promise<void>;
}

interface FormState {
  resourceType: string;
  quantity: number;
  unitCost: number;
  ownFunds: number;
  grantFunds: number;
  comment: string;
}

const emptyForm = (): FormState => ({ resourceType: '', quantity: 0, unitCost: 0, ownFunds: 0, grantFunds: 0, comment: '' });

export function BudgetSection({ applicationId, items, readOnly = false, onChanged }: Props) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<BudgetItem | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<BudgetItem | null>(null);
  const [deleteSaving, setDeleteSaving] = useState(false);

  const startCreate = () => {
    setEditing(null);
    setForm(emptyForm());
    setError(null);
    setOpen(true);
  };

  const startEdit = (item: BudgetItem) => {
    setEditing(item);
    setForm({
      resourceType: item.resourceType,
      quantity: item.quantity ?? 0,
      unitCost: item.unitCost ?? 0,
      ownFunds: item.ownFunds ?? 0,
      grantFunds: item.grantFunds ?? 0,
      comment: item.comment ?? '',
    });
    setError(null);
    setOpen(true);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload: BudgetPayload = {
        resource_type: form.resourceType,
        quantity: form.quantity,
        unit_cost: form.unitCost,
        own_funds: form.ownFunds,
        grant_funds: form.grantFunds,
        comment: form.comment || null,
      };
      if (editing) await applicationsApi.budget.update(applicationId, editing.id, payload);
      else await applicationsApi.budget.create(applicationId, payload);
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
      await applicationsApi.budget.remove(applicationId, deleting.id);
      setDeleting(null);
      await onChanged();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Не удалось удалить');
    } finally {
      setDeleteSaving(false);
    }
  };

  const columns: TableColumn<BudgetItem>[] = [
    { key: 'resource', header: 'Требуемый ресурс', field: 'resourceType' },
    { key: 'quantity', header: 'Кол-во', render: (i) => i.quantity ?? '—' },
    { key: 'unit', header: 'Цена за ед., ₽', render: (i) => money(i.unitCost) },
    { key: 'own', header: 'Собственные и привлечённые средства, ₽', render: (i) => money(i.ownFunds) },
    { key: 'grant', header: 'Средства гранта, ₽', render: (i) => money(i.grantFunds) },
    // Итог по статье — собственные (привлечённые) + средства гранта.
    { key: 'total', header: 'Итого, ₽', render: (i) => money(itemTotal(i)) },
    { key: 'comment', header: 'Комментарий', render: (i) => i.comment ?? '—' },
  ];
  if (!readOnly) {
    columns.push({
      key: 'actions',
      header: '',
      width: '100px',
      render: (i) => (
        <div className={styles.actions}>
          <Button size="sm" variant="ghost" icon="edit" aria-label="Изменить" onClick={() => startEdit(i)} />
          <Button size="sm" variant="ghost" icon="delete" aria-label="Удалить" onClick={() => setDeleting(i)} />
        </div>
      ),
    });
  }

  const ownTotal = sumBy(items, (i) => i.ownFunds ?? 0);
  const grantTotal = sumBy(items, (i) => i.grantFunds ?? 0);
  const computedTotal = sumBy(items, itemCost);
  const fundingTotal = ownTotal + grantTotal;
  const sectionMismatch = budgetMismatch(computedTotal, fundingTotal);

  // Живая проверка в форме: статья из формы заменяет редактируемую, а не добавляется к ней.
  const formItemCost = (form.quantity || 0) * (form.unitCost || 0);
  const formItemFunding = (form.ownFunds || 0) + (form.grantFunds || 0);
  const projectedCost = computedTotal - (editing ? itemCost(editing) : 0) + formItemCost;
  const projectedFunding = fundingTotal - (editing ? itemTotal(editing) : 0) + formItemFunding;
  const formMismatch = budgetMismatch(projectedCost, projectedFunding);

  return (
    <>
      {!readOnly ? (
        <div className={styles.sectionToolbar}>
          <Button size="sm" icon="add" onClick={startCreate}>
            Добавить статью
          </Button>
        </div>
      ) : null}
      {items.length === 0 ? (
        <StateMessage state="empty" message="Бюджет не заполнен" />
      ) : (
        <>
          <Table columns={columns} data={items} rowKey={(i) => i.id} />
          <div className={styles.budgetSummary}>
            <span>
              Расчётная стоимость: <strong>{money(computedTotal)}</strong>
            </span>
            <span>
              Собственные и привлечённые: <strong>{money(ownTotal)}</strong>
            </span>
            <span>
              Средства гранта: <strong>{money(grantTotal)}</strong>
            </span>
            <span>
              Всего финансирование: <strong>{money(fundingTotal)}</strong>
            </span>
          </div>
          {sectionMismatch.tone === 'ok' ? null : (
            <div className={sectionMismatch.tone === 'error' ? styles.error : styles.warning}>
              {budgetMismatchText(sectionMismatch)}
            </div>
          )}
        </>
      )}

      <Modal open={open} title={editing ? 'Статья бюджета' : 'Новая статья'} onClose={() => setOpen(false)} width={520}>
        <form className={styles.form} onSubmit={handleSubmit}>
          <Input
            label="Требуемый ресурс"
            value={form.resourceType}
            onChange={(e) => setForm({ ...form, resourceType: e.target.value })}
            required
          />
          <div className={styles.grid2}>
            <NumberInput label="Кол-во" value={form.quantity} onChange={(value) => setForm({ ...form, quantity: value })} min={0} />
            <NumberInput
              label="Цена за единицу, ₽"
              value={form.unitCost}
              onChange={(value) => setForm({ ...form, unitCost: value })}
              min={0}
              step={1}
            />
          </div>
          <div className={styles.grid2}>
            <NumberInput
              label="Собственные и привлечённые средства, ₽"
              value={form.ownFunds}
              onChange={(value) => setForm({ ...form, ownFunds: value })}
              min={0}
              step={1}
            />
            <NumberInput
              label="Средства гранта, ₽"
              value={form.grantFunds}
              onChange={(value) => setForm({ ...form, grantFunds: value })}
              min={0}
              step={1}
            />
          </div>
          <Input label="Комментарий" value={form.comment} onChange={(e) => setForm({ ...form, comment: e.target.value })} />
          <div className={styles.calcHint}>
            <span>
              Кол-во × цена: <strong>{money(formItemCost)}</strong>
            </span>
            <span>
              Итого по статье (свои + средства гранта): <strong>{money(formItemFunding)}</strong>
            </span>
          </div>
          {/* Проверка по всей заявке с учётом вводимых значений. */}
          {formMismatch.tone === 'ok' ? null : (
            <div className={formMismatch.tone === 'error' ? styles.error : styles.warning}>
              {budgetMismatchText(formMismatch)}
            </div>
          )}
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
        title="Удаление статьи"
        message={`Удалить статью «${deleting?.resourceType ?? ''}»?`}
        confirmLabel="Удалить"
        danger
        loading={deleteSaving}
        onConfirm={() => void confirmDelete()}
        onClose={() => setDeleting(null)}
      />
    </>
  );
}
