// Раздел «Настройки конкурсов и направлений»: конкурсы (сезоны подачи) и их направления.
// Конкурс задаёт сезон, критерии и число экспертов; направления привязываются к конкурсу.
import { useState } from 'react';
import { Button } from '../../components/ui';
import { DirectionsPage } from './DirectionsPage';
import { TendersPage } from './TendersPage';
import styles from './References.module.css';

type Tab = 'tenders' | 'directions';

export function ContestSettingsPage() {
  const [tab, setTab] = useState<Tab>('tenders');
  // Направления зависят от конкурсов: при любом изменении конкурса перечитываем их список.
  const [tendersVersion, setTendersVersion] = useState(0);

  return (
    <div>
      <h1 className={styles.pageTitle}>Настройки конкурсов и направлений</h1>
      <div className={styles.tabs} role="tablist" aria-label="Разделы">
        <Button size="sm" variant={tab === 'tenders' ? 'primary' : 'secondary'} onClick={() => setTab('tenders')}>
          Конкурсы
        </Button>
        <Button size="sm" variant={tab === 'directions' ? 'primary' : 'secondary'} onClick={() => setTab('directions')}>
          Направления
        </Button>
      </div>

      {tab === 'tenders' ? (
        <TendersPage onChanged={() => setTendersVersion((version) => version + 1)} />
      ) : (
        <DirectionsPage refreshToken={tendersVersion} />
      )}
    </div>
  );
}
