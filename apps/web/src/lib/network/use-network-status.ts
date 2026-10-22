'use client';

import { useSyncExternalStore } from 'react';
import { onlineManager } from '@tanstack/react-query';

const subscribe = (onStoreChange: () => void) =>
  onlineManager.subscribe(onStoreChange);

export function useNetworkStatus() {
  return useSyncExternalStore(
    subscribe,
    () => onlineManager.isOnline(),
    () => true
  );
}
