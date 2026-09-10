// Страница входа.
import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Button, Container, Input } from '../../components/ui';
import { useAuth } from '../../auth/AuthContext';
import { ApiError } from '../../api/client';
import { Roles } from '../../lib/roles';
import melonLogo from '../../assets/images/Melon.png';
import styles from './LoginPage.module.css';

export function LoginPage() {
  const { user, loading, login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!loading && user) {
    return <Navigate to={user.role === Roles.admin ? '/admin' : '/'} replace />;
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email.trim(), password);
      navigate('/admin', { replace: true });
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Не удалось войти');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={styles.page}>
      <Container className={styles.card}>
        <div className={styles.brand}>
          <img src={melonLogo} alt="Логотип Arbuz CRM" className={styles.logo} />
          <h1 className={styles.title}>Arbuz CRM</h1>
          <p className={styles.subtitle}>Вход в систему</p>
        </div>

        <form className={styles.form} onSubmit={handleSubmit}>
          <Input
            label="Email"
            type="email"
            icon="login"
            autoComplete="username"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
          <Input
            label="Пароль"
            type="password"
            icon="lock"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
          {error ? <div className={styles.error}>{error}</div> : null}
          <Button type="submit" icon="login" loading={submitting} fullWidth>
            Войти
          </Button>
        </form>
      </Container>
    </div>
  );
}
