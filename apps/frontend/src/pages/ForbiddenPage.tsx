// Страница «доступ запрещён».
import { Link } from 'react-router-dom';
import { Button, Container, Icon } from '../components/ui';
import styles from './SimplePage.module.css';

export function ForbiddenPage() {
  return (
    <div className={styles.page}>
      <Container className={styles.card}>
        <Icon name="lock" size={32} />
        <h1 className={styles.title}>Доступ запрещён</h1>
        <p className={styles.text}>У вашей учётной записи нет прав для этого раздела.</p>
        <Link to="/login">
          <Button variant="secondary" icon="login">
            Ко входу
          </Button>
        </Link>
      </Container>
    </div>
  );
}
