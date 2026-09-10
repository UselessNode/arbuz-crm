// Карусель: слайды — любые элементы (кнопки, контейнеры, бейджи).
// Каждый ребёнок считается отдельным слайдом.
import { Children, useEffect, useRef, useState, type ReactNode } from 'react';
import { Icon } from '../Icon';
import styles from './Container.module.css';

export interface CarouselProps {
  children: ReactNode;
  /** Показывать точки-индикаторы. */
  showDots?: boolean;
  /** Автопрокрутка каждые N миллисекунд (0 — выключено). */
  autoPlayMs?: number;
  className?: string;
}

export function Carousel({ children, showDots = true, autoPlayMs = 0, className }: CarouselProps) {
  const slides = Children.toArray(children);
  const [index, setIndex] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (autoPlayMs > 0 && slides.length > 1) {
      timer.current = setInterval(() => {
        setIndex((prev) => (prev + 1) % slides.length);
      }, autoPlayMs);
    }
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [autoPlayMs, slides.length]);

  const goTo = (next: number) => {
    if (slides.length === 0) return;
    setIndex(((next % slides.length) + slides.length) % slides.length);
  };

  if (slides.length === 0) return null;

  return (
    <div className={`${styles.carousel} ${className ?? ''}`}>
      <div className={styles.carouselTrack} style={{ transform: `translateX(-${index * 100}%)` }}>
        {slides.map((slide, i) => (
          <div className={styles.carouselSlide} key={i} aria-hidden={i !== index}>
            {slide}
          </div>
        ))}
      </div>
      {slides.length > 1 && (
        <>
          <button type="button" className={styles.carouselArrowLeft} onClick={() => goTo(index - 1)} aria-label="Предыдущий слайд">
            <Icon name="arrow-left" size={18} />
          </button>
          <button type="button" className={styles.carouselArrowRight} onClick={() => goTo(index + 1)} aria-label="Следующий слайд">
            <Icon name="arrow-right" size={18} />
          </button>
        </>
      )}
      {showDots && slides.length > 1 && (
        <div className={styles.carouselDots}>
          {slides.map((_, i) => (
            <button
              key={i}
              type="button"
              className={i === index ? `${styles.carouselDot} ${styles.carouselDotActive}` : styles.carouselDot}
              onClick={() => goTo(i)}
              aria-label={`Слайд ${i + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
