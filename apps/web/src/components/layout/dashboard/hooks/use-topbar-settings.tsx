'use client';

import { useEffect, useState } from 'react';

export function useTopbarSettings() {
  const [accent, setAccent] = useState('blue');
  const [contrast, setContrast] = useState('standard');
  const [persistSettings, setPersistSettings] = useState(false);

  useEffect(() => {
    const saved = window.localStorage.getItem('erp-app-settings');
    if (!saved) return;

    try {
      const settings = JSON.parse(saved) as {
        accent?: string;
        contrast?: string;
      };
      if (settings.accent) setAccent(settings.accent);
      if (settings.contrast) setContrast(settings.contrast);
      setPersistSettings(true);
    } catch {
      window.localStorage.removeItem('erp-app-settings');
    }
  }, []);

  useEffect(() => {
    document.documentElement.dataset.accent = accent;
    if (persistSettings) {
      window.localStorage.setItem(
        'erp-app-settings',
        JSON.stringify({ accent, contrast })
      );
    }
  }, [accent, contrast, persistSettings]);

  useEffect(() => {
    document.documentElement.dataset.contrast = contrast;
  }, [contrast]);

  const updatePersistence = (enabled: boolean) => {
    setPersistSettings(enabled);
    if (enabled) {
      window.localStorage.setItem(
        'erp-app-settings',
        JSON.stringify({ accent, contrast })
      );
    } else {
      window.localStorage.removeItem('erp-app-settings');
    }
  };

  return {
    accent,
    setAccent,
    contrast,
    setContrast,
    persistSettings,
    updatePersistence,
  };
}
