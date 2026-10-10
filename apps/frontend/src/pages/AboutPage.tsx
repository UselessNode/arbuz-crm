// Страница «О проекте». Текст редактируется администратором (настройки сайта, ключ `about`).
import { Container, StateMessage } from '../components/ui';
import { useSiteSetting } from '../lib/site/use-site-setting';
import styles from './AboutPage.module.css';

/** Запасной текст, если настройка недоступна. */
const FALLBACK = [
  '**#Арбузныйгрант** — информационная система приёма и рассмотрения грантовых заявок для некоммерческих организаций.',
  '',
  'Система сопровождает полный цикл: подача заявки, её экспертиза и итоговое решение.',
].join('\n');

export function AboutPage() {
  const setting = useSiteSetting('about', FALLBACK);

  return (
    <div className={styles.page}>
      <Container title="О проекте">
        {setting.loading ? (
          <StateMessage state="loading" />
        ) : (
          <div className={styles.content}>
            <div className={styles.document} dangerouslySetInnerHTML={{ __html: setting.html }} />
          </div>
        )}
      </Container>
    </div>
  );
}
