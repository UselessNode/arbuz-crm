// Страница «не найдено».
import { Link } from 'react-router-dom';
import { Button, Container, Icon } from '../components/ui';
import styles from './SimplePage.module.css';

export function NotFoundPage() {
  return (
    <div className={styles.page}>
      <Container className={styles.card}>
        <Icon name="search" size={32} />
        <h1 className={styles.title}>Страница не найдена</h1>
        <p className={styles.text}>Такого адреса не существует.</p>
        <Link to="/">
          <Button variant="secondary" icon="arrow-left">
            На главную
          </Button>
        </Link>
      </Container>
    </div>
  );
}
