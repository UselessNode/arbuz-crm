// Каркас авторизованной части: сайдбар с навигацией по ролям и ролевым тоном, шапка, футер.
import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Icon } from '../components/ui';
import { useAuth } from '../auth/AuthContext';
import { ThemeToggle } from '../theme/ThemeToggle';
import { formatUserName } from '../lib/format';
import { NotificationsBell } from '../notifications/NotificationsBell';
import melonLogo from '../assets/images/Melon.png';
import { Footer } from './Footer';
import { ScrollToTopButton } from './ScrollToTopButton';
import { sidebarClassForRole, navItemsForRole, titleForRole } from './roleTheme';
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
  // Мобильное меню: сайдбар выезжает оверлеем поверх контента.
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_STORAGE_KEY, collapsed ? '1' : '0');
    } catch {
      /* no-op */
    }
  }, [collapsed]);

  // На мобильном меню закрывается при смене маршрута (клик по ссылке).
  const closeMobile = () => setMobileOpen(false);

  if (!user) return null; // доступ защищён ProtectedRoute

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className={`${styles.layout} ${mobileOpen ? styles.layoutMenuOpen : ''}`}>
      {mobileOpen ? (
        <button
          type="button"
          className={styles.scrim}
          aria-label="Закрыть меню"
          onClick={closeMobile}
        />
      ) : null}
      <aside
        id="app-sidebar"
        className={`${styles.sidebar} ${sidebarClassForRole(user.role)} ${collapsed ? styles.sidebarCollapsed : ''} ${mobileOpen ? styles.sidebarMobileOpen : ''}`}
      >
        <Link to="/" className={styles.brand} title="#Арбузныйгрант" onClick={closeMobile}>
          <img src={melonLogo} alt="Логотип #Арбузныйгрант" className={styles.logo} />
          <span className={styles.brandName}>#Арбузныйгрант</span>
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
                onClick={closeMobile}
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
        <header className={styles.header}>
          <div className={styles.headerLeft}>
            <button
              type="button"
              className={styles.menuToggle}
              aria-label="Открыть меню"
              aria-controls="app-sidebar"
              aria-expanded={mobileOpen}
              onClick={() => setMobileOpen(true)}
            >
              <Icon name="menu" size={18} />
            </button>
            <span className={styles.headerTitle}>{titleForRole(user.role)}</span>
          </div>
          <div className={styles.user}>
            <span className={styles.userName}>{formatUserName(user)}</span>
            <div className={styles.headerControls}>
              <ThemeToggle className={styles.headerButton} />
              <NotificationsBell />
              <button type="button" className={styles.headerButton} onClick={handleLogout} aria-label="Выйти">
                <Icon name="logout" size={16} />
                <span className={styles.buttonLabel}>Выйти</span>
              </button>
            </div>
          </div>
        </header>
        <main className={styles.content}>
          <Outlet />
        </main>
        <Footer />
      </div>

      <ScrollToTopButton />
    </div>
  );
}
