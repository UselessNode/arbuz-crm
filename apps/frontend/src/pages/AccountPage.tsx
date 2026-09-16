// Личный кабинет (для заявителя/эксперта): профиль, контакты организаторов и выход.
import { useNavigate } from 'react-router-dom';
import { Button, Container, ROLE_OPTIONS, StateMessage, StatusBadge, useToast } from '../components/ui';
import { useAuth } from '../auth/AuthContext';
import { copyToClipboard } from '../lib/clipboard';
import { ORGANIZER_CONTACTS } from '../lib/contacts';
import { formatUserName } from '../lib/format';
import styles from './SimplePage.module.css';

export function AccountPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  if (!user) {
    return (
      <div className={styles.page}>
        <Container title="Личный кабинет" className={styles.card}>
          <StateMessage state="error" message="Пользователь не найден. Войдите заново." />
        </Container>
      </div>
    );
  }

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  const handleCopy = async (value: string) => {
    const copied = await copyToClipboard(value);
    toast.showToast({
      message: copied ? 'Контакт скопирован в буфер обмена' : 'Не удалось скопировать',
      tone: copied ? 'success' : 'error',
    });
  };

  return (
    <div className={styles.page}>
      <Container title="Личный кабинет" className={styles.card}>
        <div className={styles.profileRow}>
          <span>ФИО</span>
          <strong>{formatUserName(user)}</strong>
        </div>
        <div className={styles.profileRow}>
          <span>Email</span>
          <strong>{user.email}</strong>
        </div>
        <div className={styles.profileRow}>
          <span>Роль</span>
          <StatusBadge value={user.role} options={ROLE_OPTIONS} />
        </div>

        <div className={styles.contacts}>
          <h2 className={styles.contactsTitle}>Связь с организаторами</h2>
          <p className={styles.contactsText}>
            Вопросы по заявкам и сброс пароля — по телефону или почте ниже.
          </p>
          <button type="button" className={styles.contactValue} onClick={() => void handleCopy(ORGANIZER_CONTACTS.phone)}>
            {ORGANIZER_CONTACTS.phone}
          </button>
          <button type="button" className={styles.contactValue} onClick={() => void handleCopy(ORGANIZER_CONTACTS.email)}>
            {ORGANIZER_CONTACTS.email}
          </button>
        </div>

        <div className={styles.profileActions}>
          <Button variant="secondary" icon="logout" onClick={handleLogout}>
            Выйти
          </Button>
        </div>
      </Container>
    </div>
  );
}
