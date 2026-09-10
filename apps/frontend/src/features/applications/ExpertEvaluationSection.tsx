// Секция эксперта: оценка назначенной заявки по критериям конкурса.
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReviewStatus } from '@arbuz/shared';
import { Button, NumberInput, Select, StateMessage, Textarea, VERDICT_OPTIONS, useToast } from '../../components/ui';
import type { SelectOption } from '../../components/ui';
import { criteriaApi, type Criterion } from '../../api/references';
import { reviewsApi } from '../../api/reviews';
import { ApiError } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import type { ApplicationDetail } from '../../api/applications';
import styles from './Applications.module.css';

interface Props {
  application: ApplicationDetail;
  onChanged: () => Promise<void>;
}

const VERDICT_SELECT_OPTIONS: readonly SelectOption<ReviewStatus>[] = VERDICT_OPTIONS.map((option) => ({
  value: option.value,
  label: option.label,
}));

export function ExpertEvaluationSection({ application, onChanged }: Props) {
  const { user } = useAuth();
  const toast = useToast();
  const tenderId = application.tender?.id ?? null;
  const myReview = application.reviews.find((review) => review.expert?.id === user?.id) ?? null;

  const [criteria, setCriteria] = useState<Criterion[]>([]);
  const [values, setValues] = useState<Record<number, number>>({});
  const [verdict, setVerdict] = useState<ReviewStatus>('draft');
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const loadCriteria = useCallback(async () => {
    if (!tenderId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const response = await criteriaApi.list(tenderId);
      setCriteria(response.criteria);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Не удалось загрузить критерии конкурса');
    } finally {
      setLoading(false);
    }
  }, [tenderId]);

  useEffect(() => {
    void loadCriteria();
  }, [loadCriteria]);

  // Заполняем форму из своей рецензии и критериев конкурса.
  useEffect(() => {
    if (!myReview) return;
    setVerdict(myReview.status ?? 'draft');
    setText(myReview.text ?? '');
    const rating =
      myReview.rating && typeof myReview.rating === 'object' ? (myReview.rating as Record<string, unknown>) : {};
    const next: Record<number, number> = {};
    for (const criterion of criteria) {
      const raw = rating[String(criterion.id)];
      next[criterion.id] = typeof raw === 'number' ? raw : criterion.minValue;
    }
    setValues(next);
  }, [criteria, myReview]);

  const totalScore = useMemo(
    () => criteria.reduce((sum, criterion) => sum + (values[criterion.id] ?? criterion.minValue) * criterion.weight, 0),
    [criteria, values],
  );

  if (!myReview) {
    return <StateMessage state="empty" message="Вы не назначены экспертом по этой заявке" />;
  }

  if (!tenderId) {
    return <StateMessage state="empty" message="У заявки не задан конкурс — оценка по критериям невозможна" />;
  }

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const rating: Record<string, number> = {};
      for (const criterion of criteria) {
        rating[String(criterion.id)] = values[criterion.id] ?? criterion.minValue;
      }
      await reviewsApi.update(myReview.id, { rating, review_status: verdict, review_text: text || null });
      await onChanged();
      toast.showToast({ message: 'Рецензия сохранена', tone: 'success' });
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Не удалось сохранить рецензию');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.evaluation}>
      <div className={styles.sectionToolbar}>
        <span className={styles.metaLabel}>Итоговый балл (с учётом весов):</span>
        <strong>{totalScore.toLocaleString('ru-RU')}</strong>
      </div>

      {loading ? (
        <StateMessage state="loading" />
      ) : criteria.length === 0 ? (
        <StateMessage state="empty" message="Критерии конкурса не заданы" />
      ) : (
        <div className={styles.evaluationCriteria}>
          {criteria.map((criterion) => (
            <NumberInput
              key={criterion.id}
              label={`${criterion.name} (${criterion.minValue}–${criterion.maxValue}, вес ${criterion.weight})`}
              value={values[criterion.id] ?? criterion.minValue}
              onChange={(value) => setValues((prev) => ({ ...prev, [criterion.id]: value }))}
              min={criterion.minValue}
              max={criterion.maxValue}
              step={0.5}
            />
          ))}
        </div>
      )}

      <Select
        label="Вердикт"
        value={verdict}
        onChange={(value) => setVerdict(value as ReviewStatus)}
        options={VERDICT_SELECT_OPTIONS}
      />
      <Textarea label="Текст рецензии" value={text} onChange={(event) => setText(event.target.value)} />

      {error ? <div className={styles.error}>{error}</div> : null}
      <div className={styles.formActions}>
        <Button icon="check" loading={saving} onClick={() => void handleSave()} disabled={loading}>
          Сохранить рецензию
        </Button>
      </div>
    </div>
  );
}
