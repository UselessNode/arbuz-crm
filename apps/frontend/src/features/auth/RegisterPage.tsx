// Страница регистрации заявителя.
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { Button, Checkbox, Container, Input } from '../../components/ui';
import { useAuth } from '../../auth/AuthContext';
import { ApiError } from '../../api/client';
import { Roles } from '../../lib/roles';
import { AgreementModal } from './AgreementModal';
import melonLogo from '../../assets/images/Melon.png';
import styles from './AuthPage.module.css';

/** Длительность удержания чекбокса (мс) для подтверждения в dev-режиме. */
const HOLD_DURATION = 1500;

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
  const [agreed, setAgreed] = useState(false);
  const [agreementOpen, setAgreementOpen] = useState(false);
  const [holdProgress, setHoldProgress] = useState(0);

  const holdTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const holdIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const holdStartRef = useRef(0);

  // Останавливаем удержание и сбрасываем его индикатор.
  const clearHold = useCallback(() => {
    if (holdTimeoutRef.current !== null) {
      clearTimeout(holdTimeoutRef.current);
      holdTimeoutRef.current = null;
    }
    if (holdIntervalRef.current !== null) {
      clearInterval(holdIntervalRef.current);
      holdIntervalRef.current = null;
    }
    setHoldProgress(0);
  }, []);

  // Удержание чекбокса (только в dev): по завершении отмечает согласие без модалки.
  const startHold = useCallback(() => {
    if (!import.meta.env.DEV || agreed) return;
    clearHold();
    holdStartRef.current = Date.now();
    setHoldProgress(0);
    holdIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - holdStartRef.current;
      setHoldProgress(Math.min(100, (elapsed / HOLD_DURATION) * 100));
    }, 50);
    holdTimeoutRef.current = setTimeout(() => {
      clearHold();
      setAgreed(true);
    }, HOLD_DURATION);
  }, [agreed, clearHold]);

  // Страховка: не оставляем активные таймеры при размонтировании.
  useEffect(() => clearHold, [clearHold]);

  if (!loading && user) {
    return <Navigate to={user.role === Roles.admin ? '/admin' : '/account'} replace />;
  }

  const handleAcceptAgreement = () => {
    setAgreed(true);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!agreed) return;
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

          <div className={styles.agreement}>
            <div
              className={styles.agreementCheck}
              onMouseDown={startHold}
              onMouseUp={clearHold}
              onMouseLeave={clearHold}
              onTouchStart={startHold}
              onTouchEnd={clearHold}
            >
              <Checkbox
                checked={agreed}
                onChange={() => {
                  if (!agreed) setAgreementOpen(true);
                }}
              />
            </div>
            <button
              type="button"
              className={styles.agreementLink}
              onClick={() => setAgreementOpen(true)}
            >
              Я ознакомлен(а) и согласен(на) с соглашением на обработку персональных данных
            </button>
            {import.meta.env.DEV && holdProgress > 0 ? (
              <div className={styles.holdTrack} aria-hidden="true">
                <div className={styles.holdBar} style={{ width: `${holdProgress}%` }} />
              </div>
            ) : null}
          </div>

          {error ? <div className={styles.error}>{error}</div> : null}
          <Button type="submit" icon="register" loading={submitting} disabled={!agreed} fullWidth>
            Зарегистрироваться
          </Button>
        </form>

        <div className={styles.footer}>
          Уже есть аккаунт? <Link to="/login">Войти</Link>
        </div>
      </Container>

      <AgreementModal
        open={agreementOpen}
        onClose={() => setAgreementOpen(false)}
        onAccept={handleAcceptAgreement}
      />
    </div>
  );
}
