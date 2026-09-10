// Каркас авторизованной части: сайдбар с навигацией по ролям, цветная шапка, футер.
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Button, Icon, ROLE_OPTIONS, StatusBadge } from '../components/ui';
import { useAuth } from '../auth/AuthContext';
import { formatUserName } from '../lib/format';
import melonLogo from '../assets/images/Melon.png';
import { Footer } from './Footer';
import { headerClassForRole, navItemsForRole, titleForRole } from './roleTheme';
import styles from './AppLayout.module.css';

export function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  if (!user) return null; // доступ защищён ProtectedRoute

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className={styles.layout}>
      <aside className={styles.sidebar}>
        <Link to="/" className={styles.brand}>
          <img src={melonLogo} alt="Логотип Arbuz CRM" className={styles.logo} />
          <span className={styles.brandName}>Arbuz CRM</span>
        </Link>
        <nav className={styles.nav}>
          {navItemsForRole(user.role).map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => (isActive ? `${styles.navItem} ${styles.navItemActive}` : styles.navItem)}
            >
              <Icon name={item.icon} size={18} />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className={styles.main}>
        <header className={`${styles.header} ${headerClassForRole(user.role)}`}>
          <span className={styles.headerTitle}>{titleForRole(user.role)}</span>
          <div className={styles.user}>
            <span className={styles.userName}>{formatUserName(user)}</span>
            <StatusBadge value={user.role} options={ROLE_OPTIONS} />
            <Button variant="ghost" size="sm" icon="logout" onClick={handleLogout}>
              Выйти
            </Button>
          </div>
        </header>
        <main className={styles.content}>
          <Outlet />
        </main>
        <Footer />
      </div>
    </div>
  );
}
