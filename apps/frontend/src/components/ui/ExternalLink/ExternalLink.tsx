// Ссылка на сторонний источник: открывается в новой вкладке и помечается иконкой
// «ссылка наружу» (квадрат со стрелкой в правый верхний угол) — единообразие по всему UI.
import type { AnchorHTMLAttributes, ReactNode } from 'react';
import { Icon } from '../Icon';
import styles from './ExternalLink.module.css';

export interface ExternalLinkProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href' | 'target' | 'rel'> {
  href: string;
  children: ReactNode;
  /** Размер иконки (по умолчанию 12 — «в строке текста»). */
  iconSize?: number;
}

export function ExternalLink({ href, children, iconSize = 12, className, ...rest }: ExternalLinkProps) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={className ? `${styles.link} ${className}` : styles.link}
      {...rest}
    >
      <span className={styles.text}>{children}</span>
      <Icon name="link-external" size={iconSize} className={styles.icon} />
    </a>
  );
}
