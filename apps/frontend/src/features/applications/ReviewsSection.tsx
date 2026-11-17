// Секция «Экспертизы»: назначение экспертов, просмотр, снятие.
import { useCallback, useEffect, useState } from 'react';
import { Badge, Button, ConfirmDialog, MultiSelectFilter, ROLE_OPTIONS, StatusBadge, StateMessage, toBadgeTone } from '../../components/ui';
import type { FilterOption } from '../../components/ui';
import { reviewsApi } from '../../api/reviews';
import { usersApi, type ExpertItem } from '../../api/users';
import type { ApplicationReview } from '../../api/applications';
import { ApiError } from '../../api/client';
import { formatUserName } from '../../lib/format';
import styles from './Applications.module.css';

interface Props {
  applicationId: number;
  reviews: ApplicationReview[];
  /** Управление экспертами доступно только администратору. */
  canManage?: boolean;
  /** Сколько экспертов требуется по условиям конкурса. */
  requiredExperts?: number;
  onChanged: () => Promise<void>;
}

export function ReviewsSection({ applicationId, reviews, canManage = true, requiredExperts, onChanged }: Props) {
  const [experts, setExperts] = useState<ExpertItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [removing, setRemoving] = useState<ApplicationReview | null>(null);
  const [removeSaving, setRemoveSaving] = useState(false);

  const loadExperts = useCallback(async () => {
    try {
      // Кандидаты — эксперты и администраторы (админ тоже может писать экспертизу).
      const response = await usersApi.listAssignableExperts();
      setExperts(response.experts);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Не удалось загрузить экспертов');
    }
  }, []);

  useEffect(() => {
    void loadExperts();
  }, [loadExperts]);

  // Лимит экспертов задаётся в настройках конкурса; сервер проверяет его же.
  const limitReached = requiredExperts !== undefined && reviews.length >= requiredExperts;

  /** Поиск кандидатов по ФИО/email — уже назначенные на заявку исключены. */
  const loadCandidateOptions = useCallback(
    async (search: string): Promise<FilterOption[]> => {
      const assignedIds = new Set(reviews.map((review) => review.expert?.id));
      const query = search.trim().toLowerCase();
      return experts
        .filter((expert) => !assignedIds.has(expert.id))
        .filter((expert) => {
          if (!query) return true;
          const haystack = [expert.surname, expert.name, expert.patronymic, expert.email]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();
          return haystack.includes(query);
        })
        .map((expert) => ({
          value: String(expert.id),
          label: `${formatUserName(expert)} (${expert.email})${expert.role === 'admin' ? ' · администратор' : ''}`,
        }));
    },
    [experts, reviews],
  );

  /** Назначение выбранного кандидата (MultiSelect отдаёт массив — берём последний). */
  const handleAssign = async (values: string[]) => {
    const value = values[values.length - 1];
    if (!value) return;
    setError(null);
    setBusy(true);
    try {
      await reviewsApi.assign(applicationId, Number(value));
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
      {canManage ? (
        <div className={styles.assignRow}>
          <div className={styles.assignField}>
            <MultiSelectFilter
              label="Добавить эксперта"
              value={[]}
              onChange={(values) => void handleAssign(values)}
              loadOptions={loadCandidateOptions}
              placeholder={busy ? 'Назначение…' : 'Начните вводить ФИО или email…'}
            />
          </div>
          {requiredExperts !== undefined ? (
            <div className={styles.expertsProgress}>
              {limitReached ? (
                <>
                  Назначено экспертов: <strong>{reviews.length}</strong> из {requiredExperts} — лимит конкурса
                  исчерпан
                </>
              ) : (
                <>
                  Назначено экспертов: <strong>{reviews.length}</strong> из {requiredExperts}
                </>
              )}
            </div>
          ) : null}
        </div>
      ) : null}
      {error ? <div className={styles.error}>{error}</div> : null}

      {reviews.length === 0 ? (
        <StateMessage state="empty" message={canManage ? 'Эксперты не назначены' : 'Экспертиз пока нет'} />
      ) : (
        <div className={styles.assignedExperts}>
          {reviews.map((review) => (
            <div key={review.id} className={styles.reviewCard}>
              <div className={styles.reviewHeader}>
                <span className={styles.reviewExpert}>
                  <strong>{review.expert ? formatUserName(review.expert) : 'Эксперт удалён'}</strong>
                  {review.expert?.role ? <StatusBadge value={review.expert.role} options={ROLE_OPTIONS} /> : null}
                </span>
                <span className={styles.actions}>
                  <Badge tone={toBadgeTone(review.status?.tone)} icon="check">
                    {review.status?.name ?? 'Вердикт не выставлен'}
                  </Badge>
                  <Badge tone="neutral">Балл: {review.totalScore ?? '—'}</Badge>
                  {canManage ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      icon="close"
                      aria-label={review.expert ? `Снять эксперта ${formatUserName(review.expert)}` : 'Снять эксперта'}
                      onClick={() => setRemoving(review)}
                    />
                  ) : null}
                </span>
              </div>
              {review.text ? <p className={styles.reviewText}>{review.text}</p> : null}
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={removing !== null}
        title="Снятие эксперта"
        message={
          removing?.expert
            ? `Снять эксперта ${formatUserName(removing.expert)} с заявки? Экспертиза будет удалена.`
            : 'Снять эксперта с заявки? Экспертиза будет удалена.'
        }
        confirmLabel="Снять"
        danger
        loading={removeSaving}
        onConfirm={() => void confirmRemove()}
        onClose={() => setRemoving(null)}
      />
    </div>
  );
}
