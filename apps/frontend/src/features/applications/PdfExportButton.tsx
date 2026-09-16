// Кнопка выгрузки заявки в PDF. Готовый файл предлагается тостом со ссылкой «Скачать»
// (см. `usePdfExport`: window.open после поллинга блокируется браузером).
import { useCallback } from 'react';
import { Button } from '../../components/ui';
import { pdfExportApi } from '../../api/pdf-export';
import { usePdfExport } from '../../lib/use-pdf-export';

export function PdfExportButton({ applicationId }: { applicationId: number }) {
  const start = useCallback(async () => {
    const { job } = await pdfExportApi.start(applicationId);
    return job;
  }, [applicationId]);

  const { busy, run } = usePdfExport({ start, successMessage: 'Отчёт по заявке готов' });

  return (
    <Button variant="secondary" icon="download" loading={busy} onClick={() => void run()}>
      {busy ? 'Готовим PDF…' : 'Скачать PDF'}
    </Button>
  );
}
