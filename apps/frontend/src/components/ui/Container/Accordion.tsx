// Аккордеон: составной (Accordion + AccordionItem), поддерживает
// одиночное (по умолчанию) и множественное раскрытие.
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { Icon } from '../Icon';
import { openAccordionKey, toggleAccordionKey } from './accordion-state';
import styles from './Container.module.css';

interface AccordionContextValue {
  openKeys: Set<string>;
  toggle: (key: string) => void;
  /** Идемпотентно раскрывает секцию — для `defaultOpen`. */
  open: (key: string) => void;
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
    setOpenKeys((prev) => toggleAccordionKey(prev, key, allowMultiple));
  };

  // Раскрытие по умолчанию обязано быть идемпотентным: в StrictMode эффект выполняется
  // дважды, а его замыкание держит снимок состояния на момент монтирования —
  // «переключение» свернуло бы уже раскрытую секцию обратно (см. accordion-state.ts).
  const open = (key: string) => {
    setOpenKeys((prev) => openAccordionKey(prev, key, allowMultiple));
  };

  return (
    <AccordionContext.Provider value={{ openKeys, toggle, open }}>
      <div className={styles.accordion}>{children}</div>
    </AccordionContext.Provider>
  );
}

export interface AccordionItemProps {
  /** Уникальный ключ секции. */
  itemKey: string;
  title: ReactNode;
  children: ReactNode;
  /** Раскрыть секцию при первом показе. */
  defaultOpen?: boolean;
  /** Подсветить секцию рамкой — в ней есть ошибки, требующие внимания. */
  invalid?: boolean;
}

export function AccordionItem({ itemKey, title, children, defaultOpen = false, invalid = false }: AccordionItemProps) {
  const context = useContext(AccordionContext);
  if (!context) throw new Error('AccordionItem должен использоваться внутри Accordion');

  const open = context.openKeys.has(itemKey);

  useEffect(() => {
    if (defaultOpen) context.open(itemKey);
    // Раскрываем один раз при монтировании: ключ секции в рамках разметки не меняется.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className={[styles.accordionItem, invalid ? styles.accordionItemInvalid : ''].filter(Boolean).join(' ')}>
      <div className={styles.accordionHeader}>
        <span className={styles.accordionTitle}>{title}</span>
        <button
          type="button"
          className={styles.accordionToggle}
          onClick={() => context.toggle(itemKey)}
          aria-expanded={open}
          aria-label={open ? 'Свернуть раздел' : 'Развернуть раздел'}
          title={open ? 'Свернуть раздел' : 'Развернуть раздел'}
        >
          <Icon name={open ? 'chevron-up' : 'chevron-down'} size={16} />
        </button>
      </div>
      {open && <div className={styles.accordionContent}>{children}</div>}
    </div>
  );
}
