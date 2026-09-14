// Пояснение к разделу формы: иконка «info» и текст-подсказка.
// Тексты подсказок живут рядом с разделами (например, features/applications/section-hints.ts),
// компонент отвечает только за оформление.
import type { ReactNode } from 'react';
import { Icon } from '../Icon';
import styles from './SectionHint.module.css';

export interface SectionHintProps {
  children: ReactNode;
}

export function SectionHint({ children }: SectionHintProps) {
  return (
    <p className={styles.hint}>
      <Icon name="info" size={15} className={styles.icon} />
      <span>{children}</span>
    </p>
  );
}
