// Контейнер: карточка-обёртка с заголовком и зоной действий.
import type { ReactNode } from 'react';
import styles from './Container.module.css';

export interface ContainerProps {
  title?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  /** Тон: default — белая карточка, muted — серый фон, accent — с акцентной рамкой. */
  tone?: 'default' | 'muted' | 'accent';
  className?: string;
}

export function Container({ title, actions, children, tone = 'default', className }: ContainerProps) {
  const classes = [styles.container, styles[tone], className ?? ''].filter(Boolean).join(' ');
  return (
    <section className={classes}>
      {(title || actions) && (
        <header className={styles.header}>
          {title ? <div className={styles.title}>{title}</div> : null}
          {actions ? <div className={styles.actions}>{actions}</div> : null}
        </header>
      )}
      <div className={styles.body}>{children}</div>
    </section>
  );
}
