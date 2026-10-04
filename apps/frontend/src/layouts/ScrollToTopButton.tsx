// Кнопка «наверх»: появляется при прокрутке страницы и плавно возвращает к началу.
import { useEffect, useState } from 'react';
import { Icon } from '../components/ui';
import styles from './ScrollToTopButton.module.css';

const VISIBLE_AFTER = 400;

export function ScrollToTopButton() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > VISIBLE_AFTER);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  if (!visible) return null;

  return (
    <button
      type="button"
      className={styles.button}
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      aria-label="Наверх"
      title="Наверх"
    >
      <Icon name="arrow-up" size={18} />
    </button>
  );
}
