// Аккордеон: составной (Accordion + AccordionItem), поддерживает
// одиночное (по умолчанию) и множественное раскрытие.
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { Icon } from '../Icon';
import styles from './Container.module.css';

interface AccordionContextValue {
  openKeys: Set<string>;
  toggle: (key: string) => void;
}

const AccordionContext = createContext<AccordionContextValue | null>(null);

export interface AccordionProps {
  children: ReactNode;
  /** Разрешить несколько открытых секций одновременно. */
  allowMultiple?: boolean;
}

export function Accordion({ children, allowMultiple = false }: AccordionProps) {
  const [openKeys, setOpenKeys] = useState<Set<string>>(new Set());

  const toggle = (key: string) => {
    setOpenKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        if (!allowMultiple) next.clear();
        next.add(key);
      }
      return next;
    });
  };

  return (
    <AccordionContext.Provider value={{ openKeys, toggle }}>
      <div className={styles.accordion}>{children}</div>
    </AccordionContext.Provider>
  );
}

export interface AccordionItemProps {
  /** Уникальный ключ секции. */
  itemKey: string;
  title: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
}

export function AccordionItem({ itemKey, title, children, defaultOpen = false }: AccordionItemProps) {
  const context = useContext(AccordionContext);
  if (!context) throw new Error('AccordionItem должен использоваться внутри Accordion');

  const open = context.openKeys.has(itemKey);

  useEffect(() => {
    if (defaultOpen && !context.openKeys.has(itemKey)) {
      context.toggle(itemKey);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className={styles.accordionItem}>
      <button type="button" className={styles.accordionTrigger} onClick={() => context.toggle(itemKey)}>
        <span className={styles.accordionTitle}>{title}</span>
        <Icon name={open ? 'chevron-up' : 'chevron-down'} size={16} />
      </button>
      {open && <div className={styles.accordionContent}>{children}</div>}
    </div>
  );
}
