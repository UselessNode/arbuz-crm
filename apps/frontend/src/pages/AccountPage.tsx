// Личный кабинет (для заявителя/эксперта): профиль и выход.
import { useNavigate } from 'react-router-dom';
import { Button, Container, ROLE_OPTIONS, StatusBadge } from '../components/ui';
import { useAuth } from '../auth/AuthContext';
import { formatUserName } from '../lib/format';
import styles from './SimplePage.module.css';

export function AccountPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  if (!user) return null;

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
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
        <Button variant="secondary" icon="logout" onClick={handleLogout}>
          Выйти
        </Button>
      </Container>
    </div>
  );
}
