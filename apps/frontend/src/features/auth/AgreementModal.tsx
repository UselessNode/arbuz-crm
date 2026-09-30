// Модальное окно документа согласия: загружает текущую редакцию с сервера,
// показывает прогресс прочтения, а подтверждение открывает после прокрутки до конца.
import { useEffect, useRef, useState } from 'react';
import { Button, Modal, StateMessage } from '../../components/ui';
import { ApiError } from '../../api/client';
import { consentsApi, type ConsentDocument, type ConsentDocumentType } from '../../api/consents';
import styles from './AgreementModal.module.css';

interface AgreementModalProps {
  open: boolean;
  /** Тип документа: пользовательское соглашение или согласие на ПДн. */
  type: ConsentDocumentType;
  title: string;
  onClose: () => void;
  onAccept: () => void;
}

/** Допуск (px), при котором прокрутка считается завершённой. */
const SCROLL_TOLERANCE = 24;

function formatPublished(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('ru-RU');
}

export function AgreementModal({ open, type, title, onClose, onAccept }: AgreementModalProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [document, setDocument] = useState<ConsentDocument | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [reachedEnd, setReachedEnd] = useState(false);

  // При каждом открытии сбрасываем состояние и загружаем актуальную редакцию документа.
  useEffect(() => {
    if (!open) return;
    setProgress(0);
    setReachedEnd(false);
    setDocument(null);
    setError(null);
    if (scrollRef.current) scrollRef.current.scrollTop = 0;

    let cancelled = false;
    consentsApi
      .current(type)
      .then((response) => {
        if (!cancelled) setDocument(response.document);
      })
      .catch((caught) => {
        if (!cancelled) setError(caught instanceof ApiError ? caught.message : 'Не удалось загрузить документ');
      });
    return () => {
      cancelled = true;
    };
  }, [open, type]);

  const handleScroll = () => {
    const node = scrollRef.current;
    if (!node) return;

    const maxScroll = node.scrollHeight - node.clientHeight;
    const ratio = maxScroll > 0 ? node.scrollTop / maxScroll : 1;
    setProgress(Math.min(100, Math.max(0, Math.round(ratio * 100))));
    setReachedEnd(node.scrollHeight - node.scrollTop - node.clientHeight <= SCROLL_TOLERANCE);
  };

  const handleAccept = () => {
    onAccept();
    onClose();
  };

  return (
    <Modal
      open={open}
      title={title}
      onClose={onClose}
      width={720}
      dismissable
      footer={document && reachedEnd ? <Button onClick={handleAccept}>Согласиться и продолжить</Button> : undefined}
    >
      <div className={styles.wrap}>
        <div
          className={styles.progressTrack}
          role="progressbar"
          aria-label="Прогресс прочтения"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div className={styles.progressBar} style={{ width: `${progress}%` }} />
        </div>

        <div ref={scrollRef} className={styles.scrollArea} onScroll={handleScroll}>
          {error ? (
            <StateMessage state="error" message={error} />
          ) : !document ? (
            <StateMessage state="loading" />
          ) : (
            <div className={styles.document} dangerouslySetInnerHTML={{ __html: document.html }} />
          )}
        </div>

        {document && !reachedEnd ? <div className={styles.hint}>Прокрутите до конца, чтобы прочитать</div> : null}
        {document ? (
          <p className={styles.version}>
            Редакция от {formatPublished(document.publishedAt)} · версия {document.version}
          </p>
        ) : null}
      </div>
    </Modal>
  );
}
