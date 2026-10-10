// Публичная страница «Замеченные ошибки»: инструкция по обратной связи.
// Текст берётся из настроек сайта (ключ `errors`), редактируется администратором.
import { Container, StateMessage } from '../components/ui';
import { useSiteSetting } from '../lib/site/use-site-setting';
import styles from './AboutPage.module.css';

/** Запасной текст, если настройка недоступна. */
const FALLBACK = [
  'Если вы заметили ошибку в работе сайта, пожалуйста, сообщите нам — это помогает сделать систему надёжнее.',
  '',
  '**Куда написать:** fondmirdobra@gmail.com',
  '',
  '**Что указать в письме:**',
  '',
  '1. **Где** возникла ошибка — адрес страницы или название раздела.',
  '2. **Что вы делали** — пошагово, как дошли до ошибки (что нажимали, что вводили).',
  '3. **Что произошло** — фактический результат.',
  '4. **Что ожидалось** — как должно было сработать.',
  '5. **Когда** — дата и время (по возможности).',
  '6. **Скриншот** ошибки, если есть возможность.',
  '',
  'Чем точнее описание, тем быстрее мы сможем найти и устранить проблему. Спасибо!',
].join('\n');

export function ErrorReportPage() {
  const setting = useSiteSetting('errors', FALLBACK);

  return (
    <div className={styles.page}>
      <Container title="Замеченные ошибки">
        {setting.loading ? (
          <StateMessage state="loading" />
        ) : (
          <div className={styles.content}>
            {setting.html ? (
              <div className={styles.document} dangerouslySetInnerHTML={{ __html: setting.html }} />
            ) : (
              <div className={styles.document} dangerouslySetInnerHTML={{ __html: '' }} />
            )}
          </div>
        )}
      </Container>
    </div>
  );
}
