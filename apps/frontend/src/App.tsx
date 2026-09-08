// C:\project\arbuz-crm\apps\frontend\src\App.tsx
import { useEffect, useState } from 'react';

type Health = {
  status: string;
  database: string;
};

export function App() {
  const [health, setHealth] = useState<Health | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/health')
      .then((response) => response.json())
      .then((data: Health) => setHealth(data))
      .catch((reason: unknown) => {
        setError(reason instanceof Error ? reason.message : String(reason));
      });
  }, []);

  return (
    <main className="app">
      <h1>🍉 Arbuz CRM</h1>
      <p>Frontend запущен (React + Vite).</p>
      {health ? (
        <p>
          Backend: <strong>{health.status}</strong>, база данных:{' '}
          <strong>{health.database}</strong>
        </p>
      ) : (
        <p>Backend недоступен{error ? `: ${error}` : ''}</p>
      )}
    </main>
  );
}
