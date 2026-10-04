// Раздел «Пользователи» (admin): список с пагинацией, CRUD, роли, сброс пароля.
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import type { RoleType } from '@arbuz/shared';
import {
  Badge,
  Button,
  ConfirmDialog,
  Container,
  DateRangeInput,
  EMPTY_DATE_RANGE,
  Input,
  isDateRangeEmpty,
  ListToolbar,
  Modal,
  Pagination,
  ROLE_OPTIONS,
  SearchInput,
  Select,
  StateMessage,
  StatusBadge,
  Table,
  Textarea,
  useToast,
} from '../../components/ui';
import type { DateRange, SelectOption, TableColumn } from '../../components/ui';
import { usersApi } from '../../api/users';
import type { UserListItem } from '../../api/types';
import { ApiError } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import { Roles } from '../../lib/roles';
import { formatDate, formatDateTime, formatUserName } from '../../lib/format';
import styles from './UsersPage.module.css';

const PAGE_SIZE_OPTIONS = [20, 50, 100] as const;

/** Необязательное неотрицательное целое из строки поля. */
function parseCountInput(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const num = Number(trimmed);
  return Number.isFinite(num) ? Math.max(0, Math.trunc(num)) : undefined;
}

/** Сколько полных дней прошло с момента создания аккаунта. */
function daysSince(iso: string): number {
  const created = new Date(iso).getTime();
  if (Number.isNaN(created)) return 0;
  return Math.max(0, Math.floor((Date.now() - created) / 86_400_000));
}
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
  const toast = useToast();
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
      toast.showToast({ message: 'Пользователь сохранён', tone: 'success' });
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
  const toast = useToast();
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
      toast.showToast({ message: 'Пароль сброшен', tone: 'success' });
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

function NotifyModal({
  open,
  target,
  onClose,
}: {
  open: boolean;
  target: UserListItem | null;
  onClose: () => void;
}) {
  const toast = useToast();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTitle('');
    setBody('');
    setError(null);
  }, [open]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!target) return;
    setError(null);
    setSending(true);
    try {
      await usersApi.notify(target.id, { title: title.trim(), body: body.trim() || null });
      toast.showToast({ message: 'Уведомление отправлено', tone: 'success' });
      onClose();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Не удалось отправить уведомление');
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal
      open={open}
      title={`Уведомление — ${target ? formatUserName(target) : ''}`}
      onClose={onClose}
      width={560}
    >
      <form className={styles.form} onSubmit={handleSubmit}>
        <Input
          label="Заголовок"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          required
          maxLength={255}
        />
        <Textarea
          label="Текст"
          value={body}
          onChange={(event) => setBody(event.target.value)}
          rows={8}
          hint="Поддерживается Markdown — получатель увидит форматированный текст."
        />
        {error ? <div className={styles.error}>{error}</div> : null}
        <div className={styles.formActions}>
          <Button variant="secondary" type="button" onClick={onClose} disabled={sending}>
            Отмена
          </Button>
          <Button type="submit" icon="bell" loading={sending}>
            Отправить
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export function UsersPage() {
  const { user: currentUser } = useAuth();
  const toast = useToast();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(PAGE_SIZE_OPTIONS[0]);
  const [roleFilter, setRoleFilter] = useState<RoleType | ''>('');
  const [search, setSearch] = useState('');
  const [createdRange, setCreatedRange] = useState<DateRange>(EMPTY_DATE_RANGE);
  const [activeRange, setActiveRange] = useState<DateRange>(EMPTY_DATE_RANGE);
  const [appsMin, setAppsMin] = useState('');
  const [appsMax, setAppsMax] = useState('');
  const [showFilters, setShowFilters] = useState(false);
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
        search: search || undefined,
        createdFrom: createdRange.from || undefined,
        createdTo: createdRange.to || undefined,
        activityFrom: activeRange.from || undefined,
        activityTo: activeRange.to || undefined,
        appsMin: parseCountInput(appsMin),
        appsMax: parseCountInput(appsMax),
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
  }, [page, pageSize, roleFilter, search, createdRange, activeRange, appsMin, appsMax]);

  const activeFilterCount =
    (!isDateRangeEmpty(createdRange) ? 1 : 0) +
    (!isDateRangeEmpty(activeRange) ? 1 : 0) +
    (appsMin.trim() !== '' ? 1 : 0) +
    (appsMax.trim() !== '' ? 1 : 0);

  const resetFilters = () => {
    setCreatedRange(EMPTY_DATE_RANGE);
    setActiveRange(EMPTY_DATE_RANGE);
    setAppsMin('');
    setAppsMax('');
    setPage(1);
  };

  useEffect(() => {
    void load();
  }, [load]);

  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<UserListItem | null>(null);
  const [resetting, setResetting] = useState<UserListItem | null>(null);
  const [notifying, setNotifying] = useState<UserListItem | null>(null);
  const [deleting, setDeleting] = useState<UserListItem | null>(null);
  const [deleteSaving, setDeleteSaving] = useState(false);

  const handleRoleChange = useCallback(
    async (target: UserListItem, role: RoleType) => {
      if (currentUser?.id === target.id) return;
      setActionError(null);
      const previousRole = target.role;
      try {
        const response = await usersApi.update(target.id, { role });
        setUsers((prev) => prev.map((item) => (item.id === target.id ? response.user : item)));
        toast.showToast({
          message: 'Роль изменена',
          tone: 'success',
          action: {
            label: 'Отменить',
            onClick: () => {
              void usersApi
                .update(target.id, { role: previousRole })
                .then((reverted) => {
                  setUsers((prev) => prev.map((item) => (item.id === target.id ? reverted.user : item)));
                })
                .catch(() => {
                  setActionError('Не удалось отменить изменение роли');
                  void load();
                });
            },
          },
        });
      } catch (caught) {
        setActionError(caught instanceof ApiError ? caught.message : 'Не удалось изменить роль');
        await load();
      }
    },
    [currentUser?.id, load, toast],
  );

  const handleDelete = async () => {
    if (!deleting) return;
    setDeleteSaving(true);
    try {
      await usersApi.remove(deleting.id);
      setDeleting(null);
      toast.showToast({ message: 'Пользователь удалён', tone: 'success' });
      await load();
    } catch (caught) {
      setActionError(caught instanceof ApiError ? caught.message : 'Не удалось удалить пользователя');
    } finally {
      setDeleteSaving(false);
    }
  };

  const columns = useMemo<TableColumn<UserListItem>[]>(
    () => [
      { key: 'id', header: 'ID', width: '70px', field: 'id' as const }, // <-- as const
      { key: 'name', header: 'ФИО', render: (user) => formatUserName(user), sortValue: (user) => formatUserName(user).toLowerCase() },
      { key: 'email', header: 'Email', field: 'email' as const }, // <-- as const
      {
        key: 'activation',
        header: 'Активация',
        width: '200px',
        sortValue: (user) => (user.activatedAt ? 1 : 0),
        // Показываем только проблему: активные аккаунты не засоряют колонку.
        render: (user) => {
          if (user.activatedAt) return null;
          const days = daysSince(user.createdAt);
          const tone = days > 7 ? 'red' : days > 3 ? 'yellow' : 'gray';
          return (
            <Badge tone={tone} icon="warning" maxWidth={190}>
              {days === 0 ? 'Не активирован · сегодня' : `Не активирован · ${days} дн.`}
            </Badge>
          );
        },
      },
      {
        key: 'role',
        header: 'Роль',
        sortValue: (user) => user.role,
        render: (user) =>
          currentUser?.id === user.id ? (
            <StatusBadge value={user.role} options={ROLE_OPTIONS} />
          ) : (
            <StatusBadge value={user.role} options={ROLE_OPTIONS} onChange={(role) => void handleRoleChange(user, role)} />
          ),
      },
      {
        key: 'created',
        header: 'Создан',
        render: (user) => formatDate(user.createdAt),
        sortValue: (user) => user.createdAt,
      },
      {
        key: 'applications',
        header: 'Заявки',
        width: '90px',
        render: (user) => user.applicationsCount,
        sortValue: (user) => user.applicationsCount,
      },
      { key: 'activity', header: 'Активность', render: (user) => formatDateTime(user.lastActivity), sortValue: (user) => user.lastActivity },
      {
        key: 'actions',
        header: '',
        width: '180px',
        sortable: false,
        render: (user) => (
          <div className={styles.actions}>
            <Button
              size="sm" variant="ghost" icon="edit"
              title="Редактировать пользователя" onClick={() => setEditing(user)} />
            <Button
              size="sm" variant="ghost" icon="key"
              title="Сбросить пароль пользователя" onClick={() => setResetting(user)} />
            <Button
              size="sm" variant="ghost" icon="bell"
              title="Отправить уведомление" onClick={() => setNotifying(user)} />
            <Button
              size="sm" variant="danger" icon="delete"
              title={currentUser?.id != user.id ? "Удалить пользователя" : "Самого себя нельзя удалить"}
              disabled={currentUser?.id === user.id}
              onClick={() => setDeleting(user)}
            />
          </div>
        ),
      },
    ],
    [currentUser?.id, handleRoleChange],
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
      <ListToolbar>
        <SearchInput
          placeholder="Поиск по ФИО и email"
          onChange={(value) => {
            setSearch(value);
            setPage(1);
          }}
        />
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
        <Button
          variant="secondary"
          icon="filter"
          aria-expanded={showFilters}
          onClick={() => setShowFilters((value) => !value)}
        >
          Фильтры{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
        </Button>
      </ListToolbar>

      {showFilters ? (
        <div className={styles.filtersPanel}>
          <DateRangeInput
            label="Дата создания"
            value={createdRange}
            onChange={(value) => {
              setCreatedRange(value);
              setPage(1);
            }}
          />
          <DateRangeInput
            label="Последняя активность"
            value={activeRange}
            onChange={(value) => {
              setActiveRange(value);
              setPage(1);
            }}
          />
          <div className={styles.countRange}>
            <Input
              label="Заявок от"
              type="number"
              min={0}
              value={appsMin}
              onChange={(event) => {
                setAppsMin(event.target.value);
                setPage(1);
              }}
            />
            <Input
              label="до"
              type="number"
              min={0}
              value={appsMax}
              onChange={(event) => {
                setAppsMax(event.target.value);
                setPage(1);
              }}
            />
          </div>
          {activeFilterCount > 0 ? (
            <Button variant="ghost" icon="close" onClick={resetFilters}>
              Сбросить
            </Button>
          ) : null}
        </div>
      ) : null}

      {actionError ? <div className={styles.error}>{actionError}</div> : null}

      {loading ? (
        <StateMessage state="loading" />
      ) : error ? (
        <StateMessage state="error" message={error} onRetry={() => void load()} />
      ) : users.length === 0 ? (
        <StateMessage state="empty" message="Пользователи не найдены" />
      ) : (
        <>
          <Table
            columns={columns}
            data={users}
            rowKey={(user) => user.id}
            rowClassName={(user) => {
              if (user.activatedAt) return undefined;
              const days = daysSince(user.createdAt);
              if (days > 7) return styles.rowInactiveDanger;
              if (days > 3) return styles.rowInactiveWarning;
              return undefined;
            }}
          />
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
      <NotifyModal open={notifying !== null} target={notifying} onClose={() => setNotifying(null)} />
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
