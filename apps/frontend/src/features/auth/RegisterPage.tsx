// Страница регистрации заявителя.
import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { Button, Container, Input } from '../../components/ui';
import { useAuth } from '../../auth/AuthContext';
import { ApiError } from '../../api/client';
import { Roles } from '../../lib/roles';
import melonLogo from '../../assets/images/Melon.png';
import styles from './AuthPage.module.css';

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

  if (!loading && user) {
    return <Navigate to={user.role === Roles.admin ? '/admin' : '/account'} replace />;
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const registered = await register({
        email: email.trim(),
        password,
        surname: surname.trim() || null,
        name: name.trim() || null,
        patronymic: patronymic.trim() || null,
      });
      navigate(registered.role === Roles.admin ? '/admin' : '/account', { replace: true });
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Не удалось зарегистрироваться');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={styles.page}>
      <Container className={styles.card}>
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
          {error ? <div className={styles.error}>{error}</div> : null}
          <Button type="submit" icon="register" loading={submitting} fullWidth>
            Зарегистрироваться
          </Button>
        </form>

        <div className={styles.footer}>
          Уже есть аккаунт? <Link to="/login">Войти</Link>
        </div>
      </Container>
    </div>
  );
}
