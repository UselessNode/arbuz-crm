// Основные поля заявки: название, конкурс, направление и текстовые разделы.
// Общий компонент для формы редактирования (карточка заявки) и формы создания.
// Подсказки (если заданы администратором) выводятся над соответствующим полем.
import { Input, Select, SectionHint, Textarea } from '../../components/ui';
import type { SelectOption } from '../../components/ui';
import type { ApplicationPayload } from '../../api/applications';
import { renderSectionHintText } from './section-hint-text';
import styles from './Applications.module.css';

interface Props {
  form: ApplicationPayload;
  onChange: (patch: Partial<ApplicationPayload>) => void;
  tenderOptions: readonly SelectOption<string>[];
  directionOptions: readonly SelectOption<string>[];
  optionsLoading?: boolean;
  optionsError?: string | null;
  /** Ошибки полей: ключ — имя поля payload, значение — текст ошибки. */
  errors?: Record<string, string>;
  disabled?: boolean;
  /** Подсказки к отдельным полям «Основного» (по ключам `title`, `idea`, …). */
  hints?: Partial<Record<'title' | 'idea' | 'importance' | 'goal' | 'tasks' | 'experience' | 'results', string>>;
  /** Выбор владельца заявки — только администратор при создании. */
  owner?: {
    value: string;
    options: readonly SelectOption<string>[];
    onChange: (value: string) => void;
  };
}

/** Подсказка над полем — рендерится, только если администратор задал текст. */
function Hint({ text }: { text?: string }) {
  if (!text || !text.trim()) return null;
  return <SectionHint>{renderSectionHintText(text)}</SectionHint>;
}

export function ApplicationMainFields({
  form,
  onChange,
  tenderOptions,
  directionOptions,
  optionsLoading = false,
  optionsError = null,
  errors = {},
  disabled = false,
  hints = {},
  owner,
}: Props) {
  return (
    <div className={styles.form}>
      {optionsError ? <div className={styles.error}>{optionsError}</div> : null}
      <Hint text={hints.title} />
      <Input
        label="Название заявки"
        value={form.title}
        onChange={(event) => onChange({ title: event.target.value })}
        disabled={disabled}
        error={errors.title}
        required
      />

      {owner ? (
        <Select
          label="Заявитель (владелец)"
          placeholder="Выберите пользователя"
          value={owner.value}
          onChange={owner.onChange}
          options={owner.options}
          disabled={disabled || optionsLoading}
        />
      ) : null}

      <div className={styles.grid2}>
        <Select
          label="Конкурс"
          placeholder="Не выбрано"
          value={form.tender_id ? String(form.tender_id) : ''}
          onChange={(value) => onChange({ tender_id: value ? Number(value) : null })}
          options={tenderOptions}
          disabled={disabled || optionsLoading}
        />
        <Select
          label="Направление"
          placeholder="Не выбрано"
          value={form.direction_id ? String(form.direction_id) : ''}
          onChange={(value) => onChange({ direction_id: value ? Number(value) : null })}
          options={directionOptions}
          disabled={disabled || optionsLoading}
        />
      </div>

      <Hint text={hints.idea} />
      <Textarea
        label="Идея проекта"
        value={form.idea_description}
        onChange={(event) => onChange({ idea_description: event.target.value })}
        disabled={disabled}
        error={errors.idea_description}
        required
      />
      <Hint text={hints.importance} />
      <Textarea
        label="Значимость для команды"
        value={form.importance_to_team}
        onChange={(event) => onChange({ importance_to_team: event.target.value })}
        disabled={disabled}
        error={errors.importance_to_team}
        required
      />
      <Hint text={hints.goal} />
      <Textarea
        label="Цель проекта"
        value={form.project_goal}
        onChange={(event) => onChange({ project_goal: event.target.value })}
        disabled={disabled}
        error={errors.project_goal}
        required
      />
      <Hint text={hints.tasks} />
      <Textarea
        label="Задачи проекта"
        value={form.project_tasks}
        onChange={(event) => onChange({ project_tasks: event.target.value })}
        disabled={disabled}
        error={errors.project_tasks}
        required
      />
      <Hint text={hints.experience} />
      <Textarea
        label="Опыт реализации"
        value={form.implementation_experience ?? ''}
        onChange={(event) => onChange({ implementation_experience: event.target.value })}
        disabled={disabled}
      />
      <Hint text={hints.results} />
      <Textarea
        label="Ожидаемые результаты"
        value={form.results_description ?? ''}
        onChange={(event) => onChange({ results_description: event.target.value })}
        disabled={disabled}
      />
    </div>
  );
}
