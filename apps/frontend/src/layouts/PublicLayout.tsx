// Публичный каркас (домашняя страница, «О проекте», политика): шапка, контент, футер.
import { Link, Outlet, useNavigate } from 'react-router-dom';
import { Button } from '../components/ui';
import { useAuth } from '../auth/AuthContext';
import { Roles } from '../lib/roles';
import melonLogo from '../assets/images/Melon.png';
import { Footer } from './Footer';
import styles from './PublicLayout.module.css';

export function PublicLayout() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const cabinetPath = user?.role === Roles.admin ? '/admin' : '/account';

  return (
    <div className={styles.layout}>
      <header className={styles.header}>
        <div className={styles.left}>
          <Link to="/" className={styles.brand}>
            <img src={melonLogo} alt="Логотип Arbuz CRM" className={styles.logo} />
            <span className={styles.brandName}>Arbuz CRM</span>
          </Link>
          <nav className={styles.actions}>
            {!loading && user ? (
              <Button variant="secondary" size="sm" icon="user" onClick={() => navigate(cabinetPath)}>
                Личный кабинет
              </Button>
            ) : (
              <>
                <Button variant="ghost" size="sm" icon="login" onClick={() => navigate('/login')}>
                  Войти
                </Button>
                <Button size="sm" icon="register" onClick={() => navigate('/register')}>
                  Регистрация
                </Button>
              </>
            )}
          </nav>
        </div>
      </header>
      <main className={styles.main}>
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
