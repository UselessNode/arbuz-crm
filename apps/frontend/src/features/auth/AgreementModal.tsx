// Модальное окно обязательного соглашения: текст политики, индикатор прокрутки
// и кнопка подтверждения, доступная только после прочтения до конца.
import { useEffect, useRef, useState } from 'react';
import { Button, Modal } from '../../components/ui';
import { PrivacyPolicyContent } from '../legal/PrivacyPolicyContent';
import styles from './AgreementModal.module.css';

interface AgreementModalProps {
  open: boolean;
  onClose: () => void;
  onAccept: () => void;
}

/** Допуск (px), при котором прокрутка считается завершённой. */
const SCROLL_TOLERANCE = 24;

export function AgreementModal({ open, onClose, onAccept }: AgreementModalProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);
  const [reachedEnd, setReachedEnd] = useState(false);

  // При каждом открытии сбрасываем прокрутку, прогресс и состояние прочтения.
  useEffect(() => {
    if (!open) return;
    setProgress(0);
    setReachedEnd(false);
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [open]);

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
      title="Соглашение на обработку персональных данных"
      onClose={onClose}
      width={720}
      footer={reachedEnd ? <Button onClick={handleAccept}>Согласиться и продолжить</Button> : undefined}
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
          <PrivacyPolicyContent />
        </div>

        {!reachedEnd ? <div className={styles.hint}>Прокрутите до конца, чтобы прочитать</div> : null}
      </div>
    </Modal>
  );
}
