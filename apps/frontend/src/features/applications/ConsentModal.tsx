// Модалка «Файлы согласия участника»: загрузка, список, скачивание, удаление.
import { useCallback, useEffect, useState } from 'react';
import { Badge, Button, ConfirmDialog, DragDrop, Modal, StateMessage, useToast } from '../../components/ui';
import { applicationsApi, type ConsentFile, type TeamMember } from '../../api/applications';
import { ApiError } from '../../api/client';
import { formatDateTime, formatUserName } from '../../lib/format';
import styles from './Applications.module.css';

interface Props {
  applicationId: number;
  member: TeamMember;
  readOnly?: boolean;
  onClose: () => void;
  onChanged: () => Promise<void>;
}

export function ConsentModal({ applicationId, member, readOnly = false, onClose, onChanged }: Props) {
  const toast = useToast();
  const [consents, setConsents] = useState<ConsentFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [removing, setRemoving] = useState<ConsentFile | null>(null);
  const [removeSaving, setRemoveSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await applicationsApi.consents.list(applicationId, member.id);
      setConsents(response.consents);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Не удалось загрузить согласия');
    } finally {
      setLoading(false);
    }
  }, [applicationId, member.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleFiles = async (selected: File[]) => {
    setError(null);
    setBusy(true);
    try {
      for (const file of selected) {
        await applicationsApi.consents.upload(applicationId, member.id, file);
      }
      await load();
      await onChanged();
      toast.showToast({ message: selected.length > 1 ? 'Согласия загружены' : 'Согласие загружено', tone: 'success' });
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Не удалось загрузить файл');
    } finally {
      setBusy(false);
    }
  };

  const confirmRemove = async () => {
    if (!removing) return;
    setRemoveSaving(true);
    try {
      await applicationsApi.consents.remove(applicationId, removing.id);
      setRemoving(null);
      await load();
      await onChanged();
      toast.showToast({ message: 'Согласие удалено', tone: 'success' });
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Не удалось удалить файл');
    } finally {
      setRemoveSaving(false);
    }
  };

  return (
    <>
      <Modal open title={`Согласия — ${formatUserName(member)}`} onClose={onClose} width={560}>
        {!readOnly ? (
          <DragDrop
            onFiles={(selected) => void handleFiles(selected)}
            disabled={busy}
            hint="Скан согласия (PDF, DOCX, JPEG, PNG, MP4; до 10 МБ)"
          />
        ) : null}
        {error ? <div className={`${styles.error} ${styles.materialsTop}`}>{error}</div> : null}
        {loading ? (
          <StateMessage state="loading" />
        ) : consents.length === 0 ? (
          <StateMessage state="empty" message="Файлы согласия не загружены" />
        ) : (
          <div className={`${styles.materialsList} ${styles.materialsTop}`}>
            {consents.map((consent) => (
              <div key={consent.id} className={styles.materialRow}>
                <span>
                  <Badge tone="green" icon="document">
                    {consent.fileName ?? 'Согласие'}
                  </Badge>{' '}
                  <span className={styles.metaLabel}>{formatDateTime(consent.uploadedAt)}</span>
                </span>
                <span className={styles.actions}>
                  <Button
                    size="sm"
                    variant="ghost"
                    icon="download"
                    aria-label="Скачать"
                    onClick={() => window.open(applicationsApi.consents.downloadUrl(applicationId, consent.id), '_blank', 'noopener')}
                  />
                  {!readOnly ? (
                    <Button size="sm" variant="ghost" icon="delete" aria-label="Удалить" onClick={() => setRemoving(consent)} />
                  ) : null}
                </span>
              </div>
            ))}
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={removing !== null}
        title="Удаление согласия"
        message="Удалить файл согласия? После этого участник будет считаться без согласия."
        confirmLabel="Удалить"
        danger
        loading={removeSaving}
        onConfirm={() => void confirmRemove()}
        onClose={() => setRemoving(null)}
      />
    </>
  );
}
