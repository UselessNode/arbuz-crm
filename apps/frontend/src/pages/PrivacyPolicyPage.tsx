// Страница политики конфиденциальности (публичная), текст переиспользуется в соглашении.
import { Container } from '../components/ui';
import { PrivacyPolicyContent } from '../features/legal/PrivacyPolicyContent';
import styles from './AboutPage.module.css';

export function PrivacyPolicyPage() {
  return (
    <div className={styles.page}>
      <Container>
        <PrivacyPolicyContent />
      </Container>
    </div>
  );
}
