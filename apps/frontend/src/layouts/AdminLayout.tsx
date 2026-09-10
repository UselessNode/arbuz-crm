// Каркас панели администратора: сайдбар + шапка + контент.
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Button, Icon, ROLE_OPTIONS, StatusBadge } from '../components/ui';
import type { IconName } from '../components/ui';
import { useAuth } from '../auth/AuthContext';
import { formatUserName } from '../lib/format';
import melonLogo from '../assets/images/Melon.png';
import styles from './AdminLayout.module.css';

const NAV_ITEMS: Array<{ to: string; label: string; icon: IconName }> = [
  { to: 'users', label: 'Пользователи', icon: 'users' },
  { to: 'posts', label: 'Посты', icon: 'chat' },
  { to: 'tenders', label: 'Тендеры', icon: 'briefcase' },
  { to: 'directions', label: 'Направления', icon: 'folder' },
  { to: 'statuses', label: 'Статусы заявок', icon: 'filter' },
  { to: 'design-system', label: 'Дизайн-система', icon: 'settings' },
];

export function AdminLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className={styles.layout}>
      <aside className={styles.sidebar}>
        <div className={styles.brand}>
          <img src={melonLogo} alt="Логотип Arbuz CRM" className={styles.logo} />
          <span className={styles.brandName}>Arbuz CRM</span>
        </div>
        <nav className={styles.nav}>
          {NAV_ITEMS.map((item) => (
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
        <header className={styles.header}>
          <span className={styles.headerTitle}>Панель администратора</span>
          {user ? (
            <div className={styles.user}>
              <span className={styles.userName}>{formatUserName(user)}</span>
              <StatusBadge value={user.role} options={ROLE_OPTIONS} />
              <Button variant="ghost" size="sm" icon="logout" onClick={handleLogout}>
                Выйти
              </Button>
            </div>
          ) : null}
        </header>
        <main className={styles.content}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
