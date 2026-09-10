// Диалог проверки заявки перед отправкой: показывает проблемы и предлагает
// удалить участников без согласия (после подтверждения) для повторной проверки.
import { Button, Icon, Modal } from '../../components/ui';
import type { ApplicationValidationResult } from '../../api/applications';
import styles from './Applications.module.css';

interface Props {
  result: ApplicationValidationResult | null;
  saving: boolean;
  onClose: () => void;
  onRemoveWithoutConsent: () => void;
}

export function ApplicationValidationDialog({ result, saving, onClose, onRemoveWithoutConsent }: Props) {
  if (!result) return null;
  const hasMissingConsent = result.issues.some((issue) => issue.code === 'MISSING_CONSENT');

  return (
    <Modal open title="Заявка не готова к отправке" onClose={onClose} width={520}>
      <div className={styles.validationList}>
        {result.issues.map((issue) => (
          <div key={issue.code} className={styles.validationIssue}>
            <Icon name="warning" size={16} />
            <span>{issue.message}</span>
          </div>
        ))}
      </div>

      {hasMissingConsent ? (
        <p className={styles.mutedSmall}>
          При подтверждении участники без файла согласия будут удалены из заявки, после чего состав будет
          проверен повторно.
        </p>
      ) : null}

      <div className={styles.formActions}>
        <Button variant="secondary" onClick={onClose} disabled={saving}>
          Отмена
        </Button>
        {hasMissingConsent ? (
          <Button variant="danger" icon="check" loading={saving} onClick={onRemoveWithoutConsent}>
            Удалить без согласия и продолжить
          </Button>
        ) : null}
      </div>
    </Modal>
  );
}
