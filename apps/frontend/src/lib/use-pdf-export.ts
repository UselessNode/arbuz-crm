// Запуск PDF-отчёта и ожидание файла.
//
// Готовый PDF не открываем через window.open: поллинг идёт по таймеру, то есть
// уже не в контексте пользовательского жеста, и браузер вправе заблокировать вкладку.
// Вместо этого показываем тост со ссылкой «Скачать» — переход по ней инициирует пользователь.
import { useCallback, useEffect, useRef, useState } from 'react';
import { useToast } from '../components/ui';
import {
  PDF_MAX_ATTEMPTS,
  PDF_POLL_INTERVAL_MS,
  PdfExportStatuses,
  pdfExportApi,
  type PdfExportJob,
} from '../api/pdf-export';
import { ApiError } from '../api/client';

export interface PdfExportOptions {
  /** Запускает задание и возвращает его; ошибки бросает наружу. */
  start: () => Promise<PdfExportJob>;
  /** Подпись готового отчёта в тосте. */
  successMessage?: string;
  /** Текст ошибки, если сервер не сообщил свой. */
  errorMessage?: string;
}

export function usePdfExport({ start, successMessage = 'PDF готов', errorMessage = 'Не удалось сформировать PDF' }: PdfExportOptions) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const attemptsRef = useRef(0);
  // Не даём обновлять состояние после размонтирования (список отчётов, смена страницы).
  const aliveRef = useRef(true);

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const showReady = useCallback(
    (job: PdfExportJob) => {
      toast.showToast({
        message: `${job.label ?? successMessage}`,
        tone: 'success',
        duration: 12000,
        action: {
          label: 'Скачать',
          onClick: () => {
            // Ссылка открывается по клику пользователя — блокировка не срабатывает.
            window.location.href = pdfExportApi.downloadUrl(job.id);
          },
        },
      });
    },
    [successMessage, toast],
  );

  const poll = useCallback(
    (jobId: number) => {
      attemptsRef.current += 1;
      if (attemptsRef.current > PDF_MAX_ATTEMPTS) {
        if (aliveRef.current) setBusy(false);
        toast.showToast({ message: 'PDF готовится слишком долго — попробуйте позже', tone: 'error' });
        return;
      }
      timerRef.current = setTimeout(() => {
        pdfExportApi
          .getJob(jobId)
          .then(({ job }) => {
            if (!aliveRef.current) return;
            if (job.status === PdfExportStatuses.done) {
              setBusy(false);
              showReady(job);
            } else if (job.status === PdfExportStatuses.error) {
              setBusy(false);
              toast.showToast({ message: job.error ?? errorMessage, tone: 'error' });
            } else {
              poll(jobId);
            }
          })
          .catch((caught) => {
            if (!aliveRef.current) return;
            setBusy(false);
            toast.showToast({
              message: caught instanceof ApiError ? caught.message : 'Ошибка проверки задания',
              tone: 'error',
            });
          });
      }, PDF_POLL_INTERVAL_MS);
    },
    [errorMessage, showReady, toast],
  );

  const run = useCallback(async () => {
    setBusy(true);
    attemptsRef.current = 0;
    try {
      const job = await start();
      poll(job.id);
    } catch (caught) {
      setBusy(false);
      toast.showToast({
        message: caught instanceof ApiError ? caught.message : 'Не удалось запустить экспорт',
        tone: 'error',
      });
    }
  }, [poll, start, toast]);

  return { busy, run };
}
