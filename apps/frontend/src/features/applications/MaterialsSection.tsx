// Секция «Материалы заявки»: загрузка, скачивание, удаление.
import { useState } from 'react';
import { Badge, Button, DragDrop, StateMessage, useToast } from '../../components/ui';
import { applicationsApi, type Material } from '../../api/applications';
import { ApiError } from '../../api/client';
import { formatDateTime } from '../../lib/format';
import styles from './Applications.module.css';

interface Props {
  applicationId: number;
  materials: Material[];
  readOnly?: boolean;
  onChanged: () => Promise<void>;
}

export function MaterialsSection({ applicationId, materials, readOnly = false, onChanged }: Props) {
  const toast = useToast();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleFiles = async (selected: File[]) => {
    setError(null);
    setBusy(true);
    try {
      for (const file of selected) {
        await applicationsApi.materials.upload(applicationId, file);
      }
      await onChanged();
      toast.showToast({ message: selected.length > 1 ? 'Материалы загружены' : 'Материал загружен', tone: 'success' });
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Не удалось загрузить файл');
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async (fileId: number) => {
    setError(null);
    try {
      await applicationsApi.materials.remove(applicationId, fileId);
      await onChanged();
      toast.showToast({ message: 'Материал удалён', tone: 'success' });
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Не удалось удалить файл');
    }
  };

  return (
    <div>
      {!readOnly ? (
        <DragDrop
          onFiles={(selected) => void handleFiles(selected)}
          disabled={busy}
          hint="Перетащите файл (PDF, DOCX, JPEG, PNG, MP4; до 10 МБ)"
        />
      ) : null}
      {error ? <div className={`${styles.error} ${styles.materialsTop}`}>{error}</div> : null}
      {materials.length === 0 ? (
        <StateMessage state="empty" message="Материалы не загружены" />
      ) : (
        <div className={`${styles.materialsList} ${styles.materialsTop}`}>
          {materials.map((material) => (
            <div key={material.id} className={styles.materialRow}>
              <span>
                <Badge tone="blue" icon="document">
                  {material.fileName}
                </Badge>{' '}
                <span className={styles.metaLabel}>
                  {material.sizeBytes ? `${Math.round(material.sizeBytes / 1024)} КБ · ` : ''}
                  {formatDateTime(material.uploadedAt)}
                </span>
              </span>
              <span className={styles.actions}>
                <Button
                  size="sm"
                  variant="ghost"
                  icon="download"
                  aria-label="Скачать"
                  onClick={() => window.open(applicationsApi.materials.downloadUrl(applicationId, material.id), '_blank', 'noopener')}
                />
                {!readOnly ? (
                  <Button size="sm" variant="ghost" icon="delete" aria-label="Удалить" onClick={() => void handleRemove(material.id)} />
                ) : null}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
