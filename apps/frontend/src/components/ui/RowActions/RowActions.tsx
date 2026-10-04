import { Button } from '../Button';
import { KebabMenu } from '../Menu';
import { useIsMobile } from '../Hooks/useIsMobile';
import type { ButtonVariant, IconName } from '..';
import styles from './RowActions.module.css';

export type RowActionItem = {
  key: string;
  label: string;
  icon: IconName;
  variant?: ButtonVariant;
  danger?: boolean;
  disabled?: boolean;
  title?: string;
  /** `primary` — иконка в строке + пункт в kebab, `menu` — только в kebab. */
  placement?: 'primary' | 'menu';
  onSelect: () => void;
};

export interface RowActionsProps {
  ariaLabel: string;
  items: RowActionItem[];
  /** Принудительно свернуть в один kebab (например, для очень узких ячеек). */
  forceCompact?: boolean;
}

/** Единый рендер действий строки: иконки на десктопе, kebab на мобиле. */
export function RowActions({ ariaLabel, items, forceCompact }: RowActionsProps) {
  const isMobile = useIsMobile();
  const compact = forceCompact ?? isMobile;

  if (compact) {
    return (
      <div className={styles.mobile}>
        <KebabMenu label={ariaLabel} items={items.map(toMenuItem)} />
      </div>
    );
  }

  const primary = items.filter((item) => item.placement !== 'menu');
  const menu = items.filter((item) => item.placement === 'menu');

  return (
    <div className={styles.icons} role="group" aria-label={ariaLabel}>
      {primary.map((item) => (
        <Button
          key={item.key}
          size="sm"
          variant={item.variant ?? (item.danger ? 'danger' : 'secondary')}
          icon={item.icon}
          disabled={item.disabled}
          title={item.title}
          aria-label={item.label}
          onClick={item.onSelect}
        />
      ))}
      {menu.length > 0 ? <KebabMenu label="Ещё действия" items={menu.map(toMenuItem)} /> : null}
    </div>
  );
}

function toMenuItem(item: RowActionItem) {
  return {
    key: item.key,
    label: item.label,
    icon: item.icon,
    disabled: item.disabled,
    danger: item.danger || item.variant === 'danger',
    onSelect: item.onSelect,
  };
}
