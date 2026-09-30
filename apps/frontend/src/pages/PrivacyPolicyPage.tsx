// Страница политики конфиденциальности (публичная).
// Текст берётся из действующей редакции документа согласия на обработку ПДн —
// единый источник с регистрацией (см. `consentsApi.current`).
import { useEffect, useState } from 'react';
import { Container, StateMessage } from '../components/ui';
import { consentsApi, ConsentDocumentType, type ConsentDocument } from '../api/consents';
import { ApiError } from '../api/client';
import styles from './AboutPage.module.css';

export function PrivacyPolicyPage() {
  const [document, setDocument] = useState<ConsentDocument | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    consentsApi
      .current(ConsentDocumentType.personal_data_consent)
      .then((response) => {
        if (!cancelled) setDocument(response.document);
      })
      .catch((caught) => {
        if (!cancelled) setError(caught instanceof ApiError ? caught.message : 'Не удалось загрузить документ');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className={styles.page}>
      <Container>
        {error ? (
          <StateMessage state="error" message={error} />
        ) : !document ? (
          <StateMessage state="loading" />
        ) : (
          <div className={styles.document} dangerouslySetInnerHTML={{ __html: document.html }} />
        )}
      </Container>
    </div>
  );
}
