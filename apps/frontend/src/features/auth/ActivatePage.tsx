// Активация аккаунта, созданного администратором: пользователь подтверждает данные,
// при желании меняет пароль и обязательно принимает ПС и ПДн — только после этого аккаунт активен.
import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Button, Checkbox, Container, Input, StateMessage } from '../../components/ui';
import { useAuth } from '../../auth/AuthContext';
import { ApiError } from '../../api/client';
import { ConsentDocumentType } from '../../api/consents';
import { homePathForRole } from '../../lib/roles';
import type { AuthUser } from '../../api/types';
import { AgreementModal } from './AgreementModal';
import melonLogo from '../../assets/images/Melon.png';
import styles from './AuthPage.module.css';

/** Обязательные к принятию документы (152-ФЗ: два независимых согласия). */
const CONSENT_ITEMS = [
  {
    type: ConsentDocumentType.terms,
    title: 'Пользовательское соглашение',
    label: 'Я принимаю Пользовательское соглашение',
  },
  {
    type: ConsentDocumentType.personal_data_consent,
    title: 'Согласие на обработку персональных данных',
    label: 'Я даю согласие на обработку персональных данных',
  },
] as const;

export function ActivatePage() {
  const { user, loading } = useAuth();

  if (loading) return <StateMessage state="loading" message="Проверка сессии…" />;
  if (!user) return <Navigate to="/login" replace />;
  if (user.activatedAt) return <Navigate to={homePathForRole(user.role)} replace />;
  return <ActivateForm user={user} />;
}

function ActivateForm({ user }: { user: AuthUser }) {
  const { activate, logout } = useAuth();
  const navigate = useNavigate();
  const [surname, setSurname] = useState(user.surname ?? '');
  const [name, setName] = useState(user.name ?? '');
  const [patronymic, setPatronymic] = useState(user.patronymic ?? '');
  const [password, setPassword] = useState('');
  const [accepted, setAccepted] = useState<Record<ConsentDocumentType, boolean>>({
    [ConsentDocumentType.terms]: false,
    [ConsentDocumentType.personal_data_consent]: false,
  });
  const [openDocument, setOpenDocument] = useState<ConsentDocumentType | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const allAccepted = CONSENT_ITEMS.every((item) => accepted[item.type]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!allAccepted) return;
    setError(null);
    setSubmitting(true);
    try {
      const activated = await activate({
        surname: surname.trim() || null,
        name: name.trim() || null,
        patronymic: patronymic.trim() || null,
        password: password.trim() || undefined,
        accept_terms: accepted[ConsentDocumentType.terms],
        accept_personal_data_consent: accepted[ConsentDocumentType.personal_data_consent],
      });
      navigate(homePathForRole(activated.role), { replace: true });
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Не удалось активировать аккаунт');
    } finally {
      setSubmitting(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/', { replace: true });
  };

  return (
    <div className={styles.page}>
      <Container className={styles.card}>
        <div className={styles.backRow}>
          <Button variant="ghost" size="sm" icon="logout" onClick={() => void handleLogout()}>
            Выйти
          </Button>
        </div>

        <div className={styles.brand}>
          <img src={melonLogo} alt="Логотип Arbuz CRM" className={styles.logo} />
          <h1 className={styles.title}>Активация аккаунта</h1>
          <p className={styles.subtitle}>
            Подтвердите данные и примите соглашения, чтобы начать работу
          </p>
        </div>

        <form className={styles.form} onSubmit={handleSubmit}>
          <Input label="Логин" value={user.email} disabled />
          <div className={styles.grid2}>
            <Input label="Фамилия" value={surname} onChange={(event) => setSurname(event.target.value)} />
            <Input label="Имя" value={name} onChange={(event) => setName(event.target.value)} />
          </div>
          <Input label="Отчество" value={patronymic} onChange={(event) => setPatronymic(event.target.value)} />
          <Input
            label="Новый пароль"
            type="password"
            icon="lock"
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            hint="Необязательно. Если не менять — останется пароль, выданный администратором."
          />

          {CONSENT_ITEMS.map((item) => (
            <div key={item.type} className={styles.agreement}>
              <Checkbox
                checked={accepted[item.type]}
                onChange={() => {
                  if (!accepted[item.type]) setOpenDocument(item.type);
                }}
              />
              <button type="button" className={styles.agreementLink} onClick={() => setOpenDocument(item.type)}>
                {item.label}
              </button>
            </div>
          ))}

          {error ? <div className={styles.error}>{error}</div> : null}
          <Button type="submit" icon="check" loading={submitting} disabled={!allAccepted} fullWidth>
            Активировать аккаунт
          </Button>
        </form>
      </Container>

      {openDocument ? (
        <AgreementModal
          open
          type={openDocument}
          title={CONSENT_ITEMS.find((item) => item.type === openDocument)?.title ?? 'Соглашение'}
          onClose={() => setOpenDocument(null)}
          onAccept={() => setAccepted((prev) => ({ ...prev, [openDocument]: true }))}
        />
      ) : null}
    </div>
  );
}
