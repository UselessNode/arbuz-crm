// Общий подвал приложения: ссылки, реквизиты организации (из настроек сайта), копирайт.
import { Link } from 'react-router-dom';
import { ExternalLink } from '../components/ui';
import { useSiteSetting } from '../lib/site/use-site-setting';
import styles from './Footer.module.css';

export function Footer() {
  const year = new Date().getFullYear();
  // Реквизиты и дополнительный текст подвала правит администратор (раздел «Настройки сайта»).
  const footer = useSiteSetting('footer');
  const hasFooterText = footer.text.trim().length > 0;

  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <div className={styles.links}>
          <Link to="/about">О проекте</Link>
          <Link to="/privacy">Политика конфиденциальности</Link>
          <Link to="/errors">Замеченные ошибки</Link>
        </div>
        {/* Внешние адреса — только через ExternalLink: открывается в новой вкладке
            и помечается иконкой «ссылка наружу». */}
        <div className={styles.contacts}>
          <ExternalLink href="https://edu-digital.su/">
            Разработано ООО «Цифровые образовательные решения»
          </ExternalLink>
        </div>
        <div className={styles.copy}>
          © {year} Фонд «Мир Добра» ·{' '}
          <ExternalLink href="https://vk.ru/mirdobra19">Мы во ВКонтакте</ExternalLink>
        </div>
      </div>
      {hasFooterText ? (
        <div className={styles.legal} dangerouslySetInnerHTML={{ __html: footer.html }} />
      ) : null}
    </footer>
  );
}
