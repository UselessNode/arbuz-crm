// Раздел «Пользователи» (admin): список с пагинацией, CRUD, роли, сброс пароля.
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import type { RoleType } from '@arbuz/shared';
import {
  Button,
  ConfirmDialog,
  Container,
  Input,
  Modal,
  Pagination,
  ROLE_OPTIONS,
  Select,
  StateMessage,
  StatusBadge,
  Table,
} from '../../components/ui';
import type { SelectOption, TableColumn } from '../../components/ui';
import { usersApi } from '../../api/users';
import type { UserListItem } from '../../api/types';
import { ApiError } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import { Roles } from '../../lib/roles';
import { formatDateTime, formatUserName } from '../../lib/format';
import styles from './UsersPage.module.css';

const PAGE_SIZE_OPTIONS = [20, 50, 100] as const;
const ROLE_SELECT_OPTIONS: readonly SelectOption<RoleType>[] = ROLE_OPTIONS.map((option) => ({
  value: option.value,
  label: option.label,
}));

function UserFormModal({
  open,
  initial,
  disableRoleEdit,
  onClose,
  onSaved,
}: {
  open: boolean;
  initial: UserListItem | null;
  disableRoleEdit: boolean;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const isEdit = initial !== null;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<RoleType>(Roles.applicant);
  const [surname, setSurname] = useState('');
  const [name, setName] = useState('');
  const [patronymic, setPatronymic] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setEmail(initial?.email ?? '');
    setPassword('');
    setRole(initial?.role ?? Roles.applicant);
    setSurname(initial?.surname ?? '');
    setName(initial?.name ?? '');
    setPatronymic(initial?.patronymic ?? '');
    setError(null);
  }, [open, initial]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const payload = {
        email: email.trim(),
        role,
        surname: surname.trim() || null,
        name: name.trim() || null,
        patronymic: patronymic.trim() || null,
      };
      if (isEdit && initial) {
        await usersApi.update(initial.id, payload);
      } else {
        await usersApi.create({ ...payload, password });
      }
      await onSaved();
      onClose();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Не удалось сохранить');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} title={isEdit ? 'Редактировать пользователя' : 'Новый пользователь'} onClose={onClose} width={480}>
      <form className={styles.form} onSubmit={handleSubmit}>
        <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        {!isEdit ? (
          <Input
            label="Пароль"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            hint="Минимум 8 символов"
          />
        ) : null}
        <Select
          label="Роль"
          value={role}
          onChange={(value) => setRole(value as RoleType)}
          options={ROLE_SELECT_OPTIONS}
          disabled={disableRoleEdit}
        />
        {disableRoleEdit ? <span className={styles.hint}>Свою роль изменить нельзя.</span> : null}
        <Input label="Фамилия" value={surname} onChange={(e) => setSurname(e.target.value)} />
        <Input label="Имя" value={name} onChange={(e) => setName(e.target.value)} />
        <Input label="Отчество" value={patronymic} onChange={(e) => setPatronymic(e.target.value)} />
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

function ResetPasswordModal({
  open,
  target,
  onClose,
}: {
  open: boolean;
  target: UserListItem | null;
  onClose: () => void;
}) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setPassword('');
    setError(null);
  }, [open]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!target) return;
    setError(null);
    setSaving(true);
    try {
      await usersApi.resetPassword(target.id, password);
      onClose();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Не удалось сбросить пароль');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} title={`Сброс пароля — ${target ? formatUserName(target) : ''}`} onClose={onClose} width={420}>
      <form className={styles.form} onSubmit={handleSubmit}>
        <Input
          label="Новый пароль"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          hint="Минимум 8 символов"
        />
        {error ? <div className={styles.error}>{error}</div> : null}
        <div className={styles.formActions}>
          <Button variant="secondary" type="button" onClick={onClose} disabled={saving}>
            Отмена
          </Button>
          <Button type="submit" icon="lock" loading={saving}>
            Сбросить
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export function UsersPage() {
  const { user: currentUser } = useAuth();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(PAGE_SIZE_OPTIONS[0]);
  const [roleFilter, setRoleFilter] = useState<RoleType | ''>('');
  const [users, setUsers] = useState<UserListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await usersApi.list({
        role: roleFilter || undefined,
        limit: pageSize,
        offset: (page - 1) * pageSize,
      });
      setUsers(response.users);
      setTotal(response.total);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Не удалось загрузить пользователей');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, roleFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<UserListItem | null>(null);
  const [resetting, setResetting] = useState<UserListItem | null>(null);
  const [deleting, setDeleting] = useState<UserListItem | null>(null);
  const [deleteSaving, setDeleteSaving] = useState(false);

  const handleRoleChange = async (target: UserListItem, role: RoleType) => {
    if (currentUser?.id === target.id) return;
    setActionError(null);
    try {
      const response = await usersApi.update(target.id, { role });
      setUsers((prev) => prev.map((item) => (item.id === target.id ? response.user : item)));
    } catch (caught) {
      setActionError(caught instanceof ApiError ? caught.message : 'Не удалось изменить роль');
      await load();
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    setDeleteSaving(true);
    try {
      await usersApi.remove(deleting.id);
      setDeleting(null);
      await load();
    } catch (caught) {
      setActionError(caught instanceof ApiError ? caught.message : 'Не удалось удалить пользователя');
    } finally {
      setDeleteSaving(false);
    }
  };

  const columns = useMemo<TableColumn<UserListItem>[]>(
    () => [
      { key: 'id', header: 'ID', width: '70px', field: 'id' },
      { key: 'name', header: 'ФИО', render: (user) => formatUserName(user) },
      { key: 'email', header: 'Email', field: 'email' },
      {
        key: 'role',
        header: 'Роль',
        render: (user) =>
          currentUser?.id === user.id ? (
            <StatusBadge value={user.role} options={ROLE_OPTIONS} />
          ) : (
            <StatusBadge value={user.role} options={ROLE_OPTIONS} onChange={(role) => void handleRoleChange(user, role)} />
          ),
      },
      { key: 'activity', header: 'Активность', render: (user) => formatDateTime(user.lastActivity) },
      {
        key: 'actions',
        header: '',
        width: '140px',
        render: (user) => (
          <div className={styles.actions}>
            <Button size="sm" variant="ghost" icon="edit" aria-label="Редактировать" onClick={() => setEditing(user)} />
            <Button size="sm" variant="ghost" icon="lock" aria-label="Сбросить пароль" onClick={() => setResetting(user)} />
            <Button
              size="sm"
              variant="ghost"
              icon="delete"
              aria-label="Удалить"
              disabled={currentUser?.id === user.id}
              onClick={() => setDeleting(user)}
            />
          </div>
        ),
      },
    ],
    // handleRoleChange стабилен относительно load/currentUser
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currentUser?.id],
  );

  return (
    <Container
      title="Пользователи"
      actions={
        <Button icon="add" onClick={() => setCreating(true)}>
          Добавить
        </Button>
      }
    >
      <div className={styles.toolbar}>
        <Select
          label="Фильтр по роли"
          placeholder="Все роли"
          value={roleFilter}
          onChange={(value) => {
            setRoleFilter(value as RoleType | '');
            setPage(1);
          }}
          options={ROLE_SELECT_OPTIONS}
        />
      </div>

      {actionError ? <div className={styles.error}>{actionError}</div> : null}

      {loading ? (
        <StateMessage state="loading" />
      ) : error ? (
        <StateMessage state="error" message={error} onRetry={() => void load()} />
      ) : users.length === 0 ? (
        <StateMessage state="empty" message="Пользователи не найдены" />
      ) : (
        <>
          <Table columns={columns} data={users} rowKey={(user) => user.id} />
          <Pagination
            page={page}
            pageSize={pageSize}
            total={total}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
            pageSizeOptions={PAGE_SIZE_OPTIONS}
          />
        </>
      )}

      <UserFormModal
        open={creating}
        initial={null}
        disableRoleEdit={false}
        onClose={() => setCreating(false)}
        onSaved={load}
      />
      <UserFormModal
        open={editing !== null}
        initial={editing}
        disableRoleEdit={editing?.id === currentUser?.id}
        onClose={() => setEditing(null)}
        onSaved={load}
      />
      <ResetPasswordModal open={resetting !== null} target={resetting} onClose={() => setResetting(null)} />
      <ConfirmDialog
        open={deleting !== null}
        title="Удаление пользователя"
        message={`Удалить пользователя ${deleting ? formatUserName(deleting) : ''}? Учётная запись будет помечена удалённой.`}
        confirmLabel="Удалить"
        danger
        loading={deleteSaving}
        onConfirm={() => void handleDelete()}
        onClose={() => setDeleting(null)}
      />
    </Container>
  );
}
