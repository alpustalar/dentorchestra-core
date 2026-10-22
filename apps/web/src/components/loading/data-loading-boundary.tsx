'use client';

import type { ReactNode } from 'react';
import { useIsRestoring } from '@tanstack/react-query';

import { useNetworkStatus } from '@/lib/network';

type DataLoadingBoundaryProps = {
  readonly isLoading: boolean;
  readonly label: string;
  readonly fallback: ReactNode;
  readonly hasData?: boolean;
  readonly offlineFallback?: ReactNode;
  readonly children: ReactNode;
};

/**
 * Keeps query loading states local to the data-driven region. Existing data
 * remains visible during background refetches; the skeleton is only mounted
 * while the initial payload is unavailable.
 */
export function DataLoadingBoundary({
  isLoading,
  label,
  fallback,
  hasData,
  offlineFallback,
  children,
}: DataLoadingBoundaryProps) {
  const isRestoring = useIsRestoring();
  const isOnline = useNetworkStatus();

  if (isRestoring || (isLoading && isOnline)) {
    return (
      <div role="status" aria-live="polite" aria-busy="true">
        <span className="sr-only">{label}</span>
        {fallback}
      </div>
    );
  }

  if (!isOnline && hasData === false && offlineFallback) {
    return <div role="status">{offlineFallback}</div>;
  }

  return children;
}
