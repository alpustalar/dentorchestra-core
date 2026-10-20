'use client';

import { useEffect, useState } from 'react';

const mockingEnabled =
  process.env.NODE_ENV === 'development' &&
  process.env.NEXT_PUBLIC_API_MOCKING === 'enabled';

export function ApiMockProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(!mockingEnabled);

  useEffect(() => {
    if (!mockingEnabled) return;

    let active = true;

    void import('@/mocks/browser')
      .then(({ startMockWorker }) => startMockWorker())
      .then(() => {
        if (active) setReady(true);
      })
      .catch((error: unknown) => {
        console.error('[msw] Mock worker başlatılamadı:', error);
        if (active) setReady(true);
      });

    return () => {
      active = false;
    };
  }, []);

  if (!ready) return null;

  return children;
}
