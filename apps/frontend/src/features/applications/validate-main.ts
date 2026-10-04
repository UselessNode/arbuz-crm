// Клиентская проверка обязательных полей раздела «Основное».
import type { ApplicationPayload } from '../../api/applications';

/** Обязательные поля (совпадают с NOT NULL-колонками таблицы `applications`). */
export const MAIN_REQUIRED_FIELDS = [
  'title',
  'idea_description',
  'importance_to_team',
  'project_goal',
  'project_tasks',
] as const;

const FIELD_LABELS: Record<(typeof MAIN_REQUIRED_FIELDS)[number], string> = {
  title: 'название заявки',
  idea_description: 'идею проекта',
  importance_to_team: 'значимость для команды',
  project_goal: 'цель проекта',
  project_tasks: 'задачи проекта',
};

/** Возвращает карту ошибок «поле → сообщение»; пустая карта — всё заполнено. */
export function validateMainFields(form: ApplicationPayload): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const field of MAIN_REQUIRED_FIELDS) {
    const value = form[field];
    if (value === null || value === undefined || !String(value).trim()) {
      errors[field] = `Заполните ${FIELD_LABELS[field]}`;
    }
  }
  return errors;
}
