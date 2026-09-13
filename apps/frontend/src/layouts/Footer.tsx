// Общий подвал приложения: ссылки, контакты организации, копирайт.
import { Link } from 'react-router-dom';
import styles from './Footer.module.css';

export function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <div className={styles.links}>
          <Link to="/about">О проекте</Link>
          <Link to="/privacy">Политика конфиденциальности</Link>
        </div>
        {/* TODO(contacts): заменить на реальные контактные данные организации и вынести
            в редактируемые настройки (поиск по метке TODO(contacts)). */}
        <div className={styles.contacts} data-todo="contacts">
          {/* Внешние адреса — обычные ссылки <a>: Link из react-router работает только с внутренними маршрутами. */}
          <a href="https://edu-digital.su/" target="_blank" rel="noreferrer">
            Разработано ООО «Цифровые образовательные решения»
          </a>
        </div>
        <div className={styles.copy}>
          © {year} Фонд «Мир Добра» ·{' '}
          <a href="https://vk.ru/mirdobra19" target="_blank" rel="noreferrer">
            Мы во ВКонтакте
          </a>
        </div>
      </div>
    </footer>
  );
}
