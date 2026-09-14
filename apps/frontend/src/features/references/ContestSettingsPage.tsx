// Раздел «Настройки конкурсов и направлений»: конкурсы (сезоны подачи) и их направления.
// Конкурс задаёт сезон, критерии и число экспертов; направления привязываются к конкурсу.
import { useState } from 'react';
import { DirectionsPage } from './DirectionsPage';
import { TendersPage } from './TendersPage';
import styles from './References.module.css';

export function ContestSettingsPage() {
  // Направления зависят от конкурсов: при любом изменении конкурса перечитываем их список,
  // иначе новый конкурс появляется в селекте направлений только после перезагрузки страницы.
  const [tendersVersion, setTendersVersion] = useState(0);

  return (
    <div>
      <h1 className={styles.pageTitle}>Настройки конкурсов и направлений</h1>
      <div className={styles.pageStack}>
        <TendersPage onChanged={() => setTendersVersion((version) => version + 1)} />
        <DirectionsPage refreshToken={tendersVersion} />
      </div>
    </div>
  );
}
