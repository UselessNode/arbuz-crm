// Основные поля заявки: название, конкурс, направление и текстовые разделы.
// Общий компонент для формы редактирования (карточка заявки) и формы создания.
import { Input, Select, Textarea } from '../../components/ui';
import type { SelectOption } from '../../components/ui';
import type { ApplicationPayload } from '../../api/applications';
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
  /** Выбор владельца заявки — только администратор при создании. */
  owner?: {
    value: string;
    options: readonly SelectOption<string>[];
    onChange: (value: string) => void;
  };
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
  owner,
}: Props) {
  return (
    <div className={styles.form}>
      {optionsError ? <div className={styles.error}>{optionsError}</div> : null}
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

      <Textarea
        label="Идея проекта"
        value={form.idea_description}
        onChange={(event) => onChange({ idea_description: event.target.value })}
        disabled={disabled}
        error={errors.idea_description}
        required
      />
      <Textarea
        label="Значимость для команды"
        value={form.importance_to_team}
        onChange={(event) => onChange({ importance_to_team: event.target.value })}
        disabled={disabled}
        error={errors.importance_to_team}
        required
      />
      <Textarea
        label="Цель проекта"
        value={form.project_goal}
        onChange={(event) => onChange({ project_goal: event.target.value })}
        disabled={disabled}
        error={errors.project_goal}
        required
      />
      <Textarea
        label="Задачи проекта"
        value={form.project_tasks}
        onChange={(event) => onChange({ project_tasks: event.target.value })}
        disabled={disabled}
        error={errors.project_tasks}
        required
      />
      <Textarea
        label="Опыт реализации"
        value={form.implementation_experience ?? ''}
        onChange={(event) => onChange({ implementation_experience: event.target.value })}
        disabled={disabled}
      />
      <Textarea
        label="Ожидаемые результаты"
        value={form.results_description ?? ''}
        onChange={(event) => onChange({ results_description: event.target.value })}
        disabled={disabled}
      />
    </div>
  );
}
