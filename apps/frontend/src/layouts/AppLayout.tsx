// Каркас авторизованной части: сайдбар с навигацией по ролям, цветная шапка, футер.
import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Icon } from '../components/ui';
import { useAuth } from '../auth/AuthContext';
import { formatUserName } from '../lib/format';
import { NotificationsBell } from '../notifications/NotificationsBell';
import melonLogo from '../assets/images/Melon.png';
import { Footer } from './Footer';
import { headerClassForRole, navItemsForRole, titleForRole } from './roleTheme';
import styles from './AppLayout.module.css';

const SIDEBAR_STORAGE_KEY = 'arbuz.sidebarCollapsed';

export function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  // Ленивая инициализация из localStorage. try/catch — на случай приватного
  // режима / отключённого storage, чтобы каркас не падал на ровном месте.
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(SIDEBAR_STORAGE_KEY) === '1';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_STORAGE_KEY, collapsed ? '1' : '0');
    } catch {
      /* no-op */
    }
  }, [collapsed]);

  if (!user) return null; // доступ защищён ProtectedRoute

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className={styles.layout}>
      <aside
        id="app-sidebar"
        className={`${styles.sidebar} ${collapsed ? styles.sidebarCollapsed : ''}`}
      >
        <Link to="/" className={styles.brand} title="Arbuz CRM">
          <img src={melonLogo} alt="Логотип Arbuz CRM" className={styles.logo} />
          <span className={styles.brandName}>Arbuz CRM</span>
        </Link>

        <button
          type="button"
          className={styles.collapseToggle}
          onClick={() => setCollapsed((value) => !value)}
          aria-controls="app-sidebar"
          aria-expanded={!collapsed}
          aria-label={collapsed ? 'Развернуть меню' : 'Свернуть меню'}
          title={collapsed ? 'Развернуть меню' : 'Свернуть меню'}
        >
          <Icon name={collapsed ? 'chevron-right' : 'chevron-left'} size={16} />
          <span className={styles.collapseToggleLabel}>Свернуть</span>
        </button>

        <nav className={styles.nav}>
          {navItemsForRole(user.role).map((item) =>
            item.hidden ? null : (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  isActive ? `${styles.navItem} ${styles.navItemActive}` : styles.navItem
                }
                // В свёрнутом виде подписи нет — компенсируем нативным тултипом.
                title={collapsed ? item.label : undefined}
              >
                <Icon name={item.icon} size={18} />
                <span className={styles.navLabel}>{item.label}</span>
              </NavLink>
            ),
          )}
        </nav>
      </aside>

      <div className={styles.main}>
        <header className={`${styles.header} ${headerClassForRole(user.role)}`}>
          <span className={styles.headerTitle}>{titleForRole(user.role)}</span>
          <div className={styles.user}>
            <span className={styles.userName}>{formatUserName(user)}</span>
            <div className={styles.headerControls}>
              <NotificationsBell />
              <button type="button" className={styles.headerButton} onClick={handleLogout}>
                <Icon name="logout" size={16} />
                <span>Выйти</span>
              </button>
            </div>
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
