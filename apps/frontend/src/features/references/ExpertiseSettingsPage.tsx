// Раздел «Настройки экспертизы»: статусы заявок и вердикты экспертиз (двумя вкладками).
// Оба справочника влияют на итог экспертизы, поэтому живут на одной странице.
import { useState } from 'react';
import { Button } from '../../components/ui';
import { StatusesSection } from './StatusesSection';
import { VerdictsSection } from './VerdictsSection';
import styles from './References.module.css';

type Tab = 'statuses' | 'verdicts';

export function ExpertiseSettingsPage() {
  const [tab, setTab] = useState<Tab>('statuses');

  return (
    <div>
      <h1 className={styles.pageTitle}>Настройки экспертизы</h1>
      <div className={styles.tabs} role="tablist" aria-label="Разделы">
        <Button size="sm" variant={tab === 'statuses' ? 'primary' : 'secondary'} onClick={() => setTab('statuses')}>
          Статусы заявок
        </Button>
        <Button size="sm" variant={tab === 'verdicts' ? 'primary' : 'secondary'} onClick={() => setTab('verdicts')}>
          Вердикты
        </Button>
      </div>

      {tab === 'statuses' ? <StatusesSection /> : <VerdictsSection />}
    </div>
  );
}
