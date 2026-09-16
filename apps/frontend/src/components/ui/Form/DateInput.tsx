// Поле ввода даты с маской дд.мм.гггг.
//
// Пользователь может ввести дату вручную или выбрать её в календаре — значение
// одно и то же (yyyy-mm-dd), поэтому поле и календарь всегда синхронны.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Input } from './Input';
import { applyDateMask, isCompleteMaskedDate, isRealMaskedDate, maskedToIso, isoToMasked } from './date-mask';

export interface DateInputProps {
  label?: ReactNode;
  /** Значение в формате yyyy-mm-dd ('' — не задано). */
  value: string;
  onChange: (value: string) => void;
  /** Минимальная и максимальная допустимая дата (yyyy-mm-dd). */
  min?: string;
  max?: string;
  /** Внешняя ошибка (например, «раньше даты начала»). */
  error?: ReactNode;
  hint?: ReactNode;
  disabled?: boolean;
  placeholder?: string;
}

/** Ошибка заполнения по строке маски. */
function maskError(masked: string, min?: string, max?: string): string | null {
  if (!masked) return null;
  if (!isCompleteMaskedDate(masked)) return 'Введите дату полностью: дд.мм.гггг';
  if (!isRealMaskedDate(masked)) return 'Такой даты не существует';
  const iso = maskedToIso(masked);
  if (min && iso < min) return 'Дата раньше допустимой';
  if (max && iso > max) return 'Дата позже допустимой';
  return null;
}

export function DateInput({
  label,
  value,
  onChange,
  min,
  max,
  error,
  hint,
  disabled = false,
  placeholder = 'дд.мм.гггг',
}: DateInputProps) {
  const [text, setText] = useState(() => isoToMasked(value));
  // Пока пользователь печатает, внешнее значение не должно перетирать ввод:
  // обновляем поле только когда оно разошлось с маской (правка из календаря).
  const editingRef = useRef(false);

  useEffect(() => {
    if (editingRef.current) return;
    setText(isoToMasked(value));
  }, [value]);

  const handleChange = (input: string) => {
    const masked = applyDateMask(input);
    editingRef.current = true;
    setText(masked);
    // Наружу отдаём только полное и существующее значение (или пустое).
    const iso = maskedToIso(masked);
    if (iso || masked === '') onChange(iso);
  };

  const internalError = maskError(text, min, max);
  const shownError = internalError ?? error;

  return (
    <Input
      label={label}
      value={text}
      onChange={(event) => handleChange(event.target.value)}
      onBlur={() => {
        editingRef.current = false;
        // Неполный ввод не оставляем «висеть»: возвращаем то, что принято наружу.
        if (!maskedToIso(text)) setText(isoToMasked(value));
      }}
      placeholder={placeholder}
      icon="calendar"
      inputMode="numeric"
      autoComplete="off"
      disabled={disabled}
      error={shownError}
      hint={hint}
    />
  );
}
