// Кнопка выгрузки заявки в PDF: запускает задание, опрашивает статус и открывает файл.
import { useEffect, useRef, useState } from 'react';
import { Button, useToast } from '../../components/ui';
import { pdfExportApi, PdfExportStatuses } from '../../api/pdf-export';
import { ApiError } from '../../api/client';

/** Интервал опроса статуса задания (мс) и предел ожидания. */
const POLL_INTERVAL_MS = 1500;
const MAX_ATTEMPTS = 80;

export function PdfExportButton({ applicationId }: { applicationId: number }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const attemptsRef = useRef(0);

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  const poll = (jobId: number) => {
    attemptsRef.current += 1;
    if (attemptsRef.current > MAX_ATTEMPTS) {
      setBusy(false);
      toast.showToast({ message: 'PDF готовится слишком долго — попробуйте позже', tone: 'error' });
      return;
    }
    timerRef.current = setTimeout(() => {
      pdfExportApi
        .getJob(jobId)
        .then(({ job }) => {
          if (job.status === PdfExportStatuses.done) {
            setBusy(false);
            window.open(pdfExportApi.downloadUrl(job.id), '_blank', 'noopener');
          } else if (job.status === PdfExportStatuses.error) {
            setBusy(false);
            toast.showToast({ message: job.error ?? 'Не удалось сформировать PDF', tone: 'error' });
          } else {
            poll(jobId);
          }
        })
        .catch((caught) => {
          setBusy(false);
          toast.showToast({
            message: caught instanceof ApiError ? caught.message : 'Ошибка проверки задания',
            tone: 'error',
          });
        });
    }, POLL_INTERVAL_MS);
  };

  const handleStart = async () => {
    setBusy(true);
    attemptsRef.current = 0;
    try {
      const { job } = await pdfExportApi.start(applicationId);
      poll(job.id);
    } catch (caught) {
      setBusy(false);
      toast.showToast({
        message: caught instanceof ApiError ? caught.message : 'Не удалось запустить экспорт',
        tone: 'error',
      });
    }
  };

  return (
    <Button variant="secondary" icon="download" loading={busy} onClick={() => void handleStart()}>
      {busy ? 'Готовим PDF…' : 'Скачать PDF'}
    </Button>
  );
}
