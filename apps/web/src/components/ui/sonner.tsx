'use client';

import { useTheme } from 'next-themes';
import type { CSSProperties } from 'react';
import { Toaster as Sonner, type ToasterProps } from 'sonner';

export function Toaster(props: ToasterProps) {
  const { theme = 'system' } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps['theme']}
      position="top-center"
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            'group toast border-border bg-popover text-popover-foreground shadow-lg',
          description: 'text-muted-foreground',
          actionButton:
            'min-h-11 bg-primary px-3 text-primary-foreground hover:bg-primary/90',
        },
      }}
      style={
        {
          '--normal-bg': 'var(--popover)',
          '--normal-text': 'var(--popover-foreground)',
          '--normal-border': 'var(--border)',
        } as CSSProperties
      }
      {...props}
    />
  );
}
