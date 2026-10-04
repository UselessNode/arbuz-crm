// Страница регистрации заявителя.
import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { Button, Checkbox, Container, Input } from '../../components/ui';
import { useAuth } from '../../auth/AuthContext';
import { ApiError } from '../../api/client';
import { ConsentDocumentType } from '../../api/consents';
import { homePathForRole } from '../../lib/roles';
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

export function RegisterPage() {
  const { user, loading, register } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [surname, setSurname] = useState('');
  const [name, setName] = useState('');
  const [patronymic, setPatronymic] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [accepted, setAccepted] = useState<Record<ConsentDocumentType, boolean>>({
    [ConsentDocumentType.terms]: false,
    [ConsentDocumentType.personal_data_consent]: false,
  });
  const [openDocument, setOpenDocument] = useState<ConsentDocumentType | null>(null);

  if (!loading && user) {
    return <Navigate to={homePathForRole(user.role)} replace />;
  }

  const allAccepted = CONSENT_ITEMS.every((item) => accepted[item.type]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!allAccepted) return;
    setError(null);
    setSubmitting(true);
    try {
      const registered = await register({
        email: email.trim(),
        password,
        surname: surname.trim() || null,
        name: name.trim() || null,
        patronymic: patronymic.trim() || null,
        accept_terms: accepted[ConsentDocumentType.terms],
        accept_personal_data_consent: accepted[ConsentDocumentType.personal_data_consent],
      });
      navigate(homePathForRole(registered.role), { replace: true });
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Не удалось зарегистрироваться');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={styles.page}>
      <Container className={styles.card}>
        <div className={styles.backRow}>
          <Button variant="ghost" size="sm" icon="arrow-left" onClick={() => navigate('/')}>
            Назад
          </Button>
        </div>

        <div className={styles.brand}>
          <img src={melonLogo} alt="Логотип Arbuz CRM" className={styles.logo} />
          <h1 className={styles.title}>Регистрация</h1>
          <p className={styles.subtitle}>Создайте аккаунт заявителя</p>
        </div>

        <form className={styles.form} onSubmit={handleSubmit}>
          <Input
            label="Email"
            type="email"
            icon="mail"
            autoComplete="username"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
          <Input
            label="Пароль"
            type="password"
            icon="lock"
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            hint="Минимум 8 символов"
          />
          <div className={styles.grid2}>
            <Input label="Фамилия" value={surname} onChange={(event) => setSurname(event.target.value)} />
            <Input label="Имя" value={name} onChange={(event) => setName(event.target.value)} />
          </div>
          <Input label="Отчество" value={patronymic} onChange={(event) => setPatronymic(event.target.value)} />

          {CONSENT_ITEMS.map((item) => (
            <div key={item.type} className={styles.agreement}>
              <Checkbox
                checked={accepted[item.type]}
                onChange={() => {
                  if (!accepted[item.type]) setOpenDocument(item.type);
                }}
              />
              <button
                type="button"
                className={styles.agreementLink}
                onClick={() => setOpenDocument(item.type)}
              >
                {item.label}
              </button>
            </div>
          ))}

          {error ? <div className={styles.error}>{error}</div> : null}
          <Button type="submit" icon="register" loading={submitting} disabled={!allAccepted} fullWidth>
            Зарегистрироваться
          </Button>
        </form>

        <div className={styles.footer}>
          Уже есть аккаунт? <Link to="/login">Войти</Link>
        </div>
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
