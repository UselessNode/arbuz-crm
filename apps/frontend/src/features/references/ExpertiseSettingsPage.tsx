// Раздел «Настройки экспертизы»: статусы заявок и вердикты рецензий.
// Оба справочника влияют на итог экспертизы, поэтому живут на одной странице.
import { StatusesSection } from './StatusesSection';
import { VerdictsSection } from './VerdictsSection';
import styles from './References.module.css';

export function ExpertiseSettingsPage() {
  return (
    <div>
      <h1 className={styles.pageTitle}>Настройки экспертизы</h1>
      <div className={styles.pageStack}>
        <StatusesSection />
        <VerdictsSection />
      </div>
    </div>
  );
}
