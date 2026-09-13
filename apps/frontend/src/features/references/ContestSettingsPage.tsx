// Раздел «Настройки конкурсов и направлений»: конкурсы (сезоны подачи) и их направления.
// Конкурс задаёт сезон, критерии и число экспертов; направления привязываются к конкурсу.
import { DirectionsPage } from './DirectionsPage';
import { TendersPage } from './TendersPage';
import styles from './References.module.css';

export function ContestSettingsPage() {
  return (
    <div>
      <h1 className={styles.pageTitle}>Настройки конкурсов и направлений</h1>
      <div className={styles.pageStack}>
        <TendersPage />
        <DirectionsPage />
      </div>
    </div>
  );
}
