// Текст публикации: HTML с сервера + галереи подряд идущих картинок.
//
// Санитайз на бэкенде разрешает только безопасный набор тегов, поэтому обычные блоки
// отдаём как HTML, а галереи (несколько подряд изображений) показываем каруселью.
import { useMemo } from 'react';
import { Carousel } from '../../components/ui';
import { splitPostContent } from '../../lib/post-content';
import styles from './PostContent.module.css';

interface Props {
  /** HTML, собранный и очищенный на сервере (`contentHtml`). */
  html: string;
  /** Класс для обычных блоков (оформление берётся из места использования). */
  className?: string;
}

export function PostContent({ html, className }: Props) {
  const blocks = useMemo(() => splitPostContent(html), [html]);

  return (
    <>
      {blocks.map((block, index) =>
        block.kind === 'html' ? (
          <div key={`html-${index}`} className={className} dangerouslySetInnerHTML={{ __html: block.html }} />
        ) : (
          <Carousel key={`gallery-${index}`} className={styles.gallery} showDots>
            {block.images.map((image, imageIndex) => (
              <img
                key={`${image.src}-${imageIndex}`}
                src={image.src}
                alt={image.alt}
                className={styles.galleryImage}
                loading="lazy"
              />
            ))}
          </Carousel>
        ),
      )}
    </>
  );
}
