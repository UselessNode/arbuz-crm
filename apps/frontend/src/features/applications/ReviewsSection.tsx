// Секция «Рецензии»: назначение экспертов, просмотр, снятие.
import { useCallback, useEffect, useState } from 'react';
import { Badge, Button, ConfirmDialog, Select, StateMessage, VERDICT_OPTIONS } from '../../components/ui';
import type { SelectOption } from '../../components/ui';
import { reviewsApi } from '../../api/reviews';
import { usersApi, type ExpertItem } from '../../api/users';
import type { ApplicationReview } from '../../api/applications';
import { ApiError } from '../../api/client';
import { formatUserName } from '../../lib/format';
import styles from './Applications.module.css';

interface Props {
  applicationId: number;
  reviews: ApplicationReview[];
  onChanged: () => Promise<void>;
}

export function ReviewsSection({ applicationId, reviews, onChanged }: Props) {
  const [experts, setExperts] = useState<ExpertItem[]>([]);
  const [selectedExpert, setSelectedExpert] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [removing, setRemoving] = useState<ApplicationReview | null>(null);
  const [removeSaving, setRemoveSaving] = useState(false);

  const loadExperts = useCallback(async () => {
    try {
      const response = await usersApi.listExperts();
      setExperts(response.experts);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Не удалось загрузить экспертов');
    }
  }, []);

  useEffect(() => {
    void loadExperts();
  }, [loadExperts]);

  const expertOptions: readonly SelectOption<string>[] = experts.map((expert) => ({
    value: String(expert.id),
    label: `${formatUserName(expert)} (${expert.email})`,
  }));

  const handleAssign = async (value: string) => {
    setSelectedExpert(value);
    if (!value) return;
    setError(null);
    setBusy(true);
    try {
      await reviewsApi.assign(applicationId, Number(value));
      setSelectedExpert('');
      await onChanged();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Не удалось назначить эксперта');
    } finally {
      setBusy(false);
    }
  };

  const confirmRemove = async () => {
    if (!removing) return;
    setRemoveSaving(true);
    try {
      await reviewsApi.remove(removing.id);
      setRemoving(null);
      await onChanged();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Не удалось снять эксперта');
    } finally {
      setRemoveSaving(false);
    }
  };

  return (
    <div>
      <div className={styles.sectionToolbar}>
        <Select
          placeholder="Добавить эксперта…"
          value={selectedExpert}
          onChange={(value) => void handleAssign(value)}
          options={expertOptions}
          disabled={busy}
        />
      </div>
      {error ? <div className={styles.error}>{error}</div> : null}

      {reviews.length === 0 ? (
        <StateMessage state="empty" message="Эксперты не назначены" />
      ) : (
        <div className={styles.assignedExperts}>
          {reviews.map((review) => {
            const verdict =
              VERDICT_OPTIONS.find((option) => option.value === (review.status ?? 'draft')) ?? VERDICT_OPTIONS[0];
            return (
              <div key={review.id} className={styles.reviewCard}>
                <div className={styles.reviewHeader}>
                  <strong>{review.expert ? formatUserName(review.expert) : 'Эксперт удалён'}</strong>
                  <span className={styles.actions}>
                    <Badge tone={verdict.tone} icon={verdict.icon}>
                      {verdict.label}
                    </Badge>
                    <Badge tone="neutral">Балл: {review.totalScore ?? '—'}</Badge>
                    <Button size="sm" variant="ghost" icon="close" aria-label="Снять эксперта" onClick={() => setRemoving(review)} />
                  </span>
                </div>
                {review.text ? <p className={styles.reviewText}>{review.text}</p> : null}
              </div>
            );
          })}
        </div>
      )}

      <ConfirmDialog
        open={removing !== null}
        title="Снятие эксперта"
        message="Снять эксперта с заявки? Рецензия будет удалена."
        confirmLabel="Снять"
        danger
        loading={removeSaving}
        onConfirm={() => void confirmRemove()}
        onClose={() => setRemoving(null)}
      />
    </div>
  );
}
