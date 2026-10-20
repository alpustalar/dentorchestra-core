'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Check,
  Computer,
  Expand,
  Languages,
  Moon,
  Settings,
  Sun,
} from 'lucide-react';
import { useTheme } from 'next-themes';
import { useLocale } from 'next-intl';
import { usePathname, useRouter } from '@/i18n/navigation';
import { cn } from '@/lib/utils';

const accents = [
  { key: 'blue', label: 'Okyanus', color: 'oklch(0.55 0.19 255)' },
  { key: 'violet', label: 'Viyole', color: 'oklch(0.56 0.18 290)' },
  { key: 'teal', label: 'Teal', color: 'oklch(0.54 0.14 180)' },
  { key: 'amber', label: 'Amber', color: 'oklch(0.68 0.16 75)' },
  { key: 'rose', label: 'Gül', color: 'oklch(0.59 0.18 15)' },
];

interface SettingsMenuProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  buttonSize?: 'default' | 'lg';
  accent: string;
  setAccent: (accent: string) => void;
  contrast: string;
  setContrast: (contrast: string) => void;
  persistSettings: boolean;
  updatePersistence: (enabled: boolean) => void;
}

export function SettingsMenu({
                               open,
                               onOpenChange,
                               buttonSize = 'default',
                               accent,
                               setAccent,
                               contrast,
                               setContrast,
                               persistSettings,
                               updatePersistence,
                             }: SettingsMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const { theme, setTheme } = useTheme();
  const router = useRouter();
  const pathname = usePathname();
  const locale = useLocale();

  useEffect(() => {
    const syncFullscreenState = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };

    syncFullscreenState();
    document.addEventListener('fullscreenchange', syncFullscreenState);
    return () =>
      document.removeEventListener('fullscreenchange', syncFullscreenState);
  }, []);

  const toggleFullscreen = async (enabled: boolean) => {
    try {
      if (enabled) {
        await document.documentElement.requestFullscreen();
      } else if (document.fullscreenElement) {
        await document.exitFullscreen();
      }
    } catch {
      // Keep the switch in sync with the browser's fullscreen state.
    }
  };

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        menuRef.current?.contains(event.target)
      ) {
        return;
      }

      onOpenChange(false);
    };

    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [open, onOpenChange]);

  return (
    <div ref={menuRef} className="relative">
    <button
      type="button"
  onClick={() => onOpenChange(!open)}
  aria-expanded={open}
  aria-label="Uygulama ayarlarını aç"
  className={cn(
    'flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
    buttonSize === 'lg' && 'h-10 w-10'
  )}
  >
  <Settings
    className={cn(
      'animate-settings-spin h-[1.15rem] w-[1.15rem]',
      buttonSize === 'lg' && 'h-6 w-6'
    )}
  />
    </button>

  {open && (
    <div className="absolute right-0 top-12 z-40 max-h-[calc(100vh-5rem)] w-72 overflow-y-auto rounded-xl border border-border bg-popover p-4 text-popover-foreground shadow-xl">
    <div className="flex items-start justify-between gap-3 border-b border-border pb-3">
    <div>
      <p className="text-sm font-semibold">Uygulama ayarları</p>
  <p className="mt-1 text-xs text-muted-foreground">
    Çalışma alanınızı kişiselleştirin.
  </p>
  </div>
  <Settings className="mt-0.5 size-4 text-primary" />
    </div>

    {/* Görünüm */}
    <div className="pt-4">
    <p className="mb-2 text-xs font-medium text-muted-foreground">Görünüm</p>
      <div className="grid grid-cols-3 gap-1 rounded-lg bg-muted p-1" role="radiogroup">
    {[
        { key: 'light', label: 'Açık', icon: Sun },
    { key: 'dark', label: 'Koyu', icon: Moon },
    { key: 'system', label: 'Sistem', icon: Computer },
  ].map((item) => {
    const ModeIcon = item.icon;
    return (
      <button
        key={item.key}
    type="button"
    role="radio"
    aria-checked={theme === item.key}
    onClick={() => setTheme(item.key)}
    className={cn(
      'flex items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-[11px] transition-colors',
      theme === item.key
      ? 'bg-card font-medium text-foreground shadow-sm'
      : 'text-muted-foreground hover:text-foreground'
  )}
  >
    <ModeIcon className="size-3.5" />
      {item.label}
      </button>
  );
  })}
    </div>
    </div>

    {/* Fullscreen */}
    <div className="mt-4 border-t border-border pt-3">
      <label className="flex cursor-pointer items-center justify-between gap-3">
        <span className="flex items-center gap-2 text-xs font-medium text-foreground">
          <Expand className="size-4 text-primary" />
          Tam ekran modu
        </span>
        <span className="relative flex size-9 shrink-0 items-center justify-center">
          <input
            type="checkbox"
            role="switch"
            checked={isFullscreen}
            onChange={(event) => void toggleFullscreen(event.target.checked)}
            className="peer sr-only"
            aria-label="Tam ekran modunu aç veya kapat"
          />
          <span className="pointer-events-none absolute h-5 w-9 rounded-full bg-muted transition-colors peer-checked:bg-primary" />
          <span className="pointer-events-none absolute left-1 size-3.5 rounded-full border border-border bg-background shadow-sm transition-transform peer-checked:translate-x-4" />
        </span>
      </label>
    </div>

    {/* Dil */}
    <div className="mt-4 border-t border-border pt-4">
    <div className="mb-2 flex items-center gap-2 text-xs font-medium text-muted-foreground">
    <Languages className="size-4 text-primary" />
      Uygulama dili
  </div>
  <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1" role="radiogroup">
    {[
        { key: 'tr', label: 'Türkçe' },
    { key: 'en', label: 'English' },
  ].map((item) => (
    <button
      key={item.key}
    type="button"
    role="radio"
    aria-checked={locale === item.key}
    onClick={() => {
    if (locale === item.key) return;
    router.replace(pathname, { locale: item.key as 'tr' | 'en' });
  }}
    className={cn(
      'rounded-md px-2 py-1.5 text-xs transition-colors',
      locale === item.key
      ? 'bg-card font-medium text-foreground shadow-sm'
      : 'text-muted-foreground hover:text-foreground'
  )}
  >
    {item.label}
    </button>
  ))}
    </div>
    </div>

    {/* Tema Rengi */}
    <div className="mt-4 border-t border-border pt-4">
    <p className="mb-2 text-xs font-medium text-muted-foreground">Tema rengi</p>
  <div className="grid grid-cols-5 gap-2" role="radiogroup">
    {accents.map((item) => (
        <button
          key={item.key}
      type="button"
      role="radio"
      aria-checked={accent === item.key}
    title={item.label}
    onClick={() => setAccent(item.key)}
    className="group flex flex-col items-center gap-1.5 rounded-lg p-1.5 transition-colors hover:bg-muted"
    >
    <span
      className={cn(
      'flex size-8 items-center justify-center rounded-full ring-offset-2 ring-offset-popover transition-shadow',
      accent === item.key && 'ring-2 ring-ring'
  )}
    style={{ backgroundColor: item.color }}
  >
    {accent === item.key && <Check className="size-4 text-white" />}
    </span>
    <span className="text-[10px] text-muted-foreground">{item.label}</span>
    </button>
  ))}
    </div>
    </div>

    {/* Kontrast */}
    <div className="mt-4 border-t border-border pt-4">
    <p className="mb-2 text-xs font-medium text-muted-foreground">Kontrast</p>
      <div className="grid grid-cols-3 gap-1 rounded-lg bg-muted p-1" role="radiogroup">
    {[
        { key: 'soft', label: 'Yumuşak' },
    { key: 'standard', label: 'Standart' },
    { key: 'high', label: 'Yüksek' },
  ].map((item) => (
    <button
      key={item.key}
    type="button"
    role="radio"
    aria-checked={contrast === item.key}
    onClick={() => setContrast(item.key)}
    className={cn(
      'rounded-md px-2 py-1.5 text-[11px] transition-colors',
      contrast === item.key
      ? 'bg-card font-medium text-foreground shadow-sm'
      : 'text-muted-foreground hover:text-foreground'
  )}
  >
    {item.label}
    </button>
  ))}
    </div>
    </div>

    {/* Oturum Kalıcılığı */}
    <div className="mt-4 border-t border-border pt-3">
    <label className="flex cursor-pointer items-center justify-between gap-3">
    <span className="flex flex-col gap-1">
    <span className="text-xs font-medium text-foreground">Ayarları hatırla</span>
  <span className="text-[11px] text-muted-foreground">
    {persistSettings ? 'Ayarlarınız tüm oturumlarda uygulanır.' : 'Ayarlarınız bu oturum için uygulanır.'}
    </span>
    </span>
    <span className="relative flex size-9 shrink-0 items-center justify-center">
  <input
    type="checkbox"
    checked={persistSettings}
    onChange={(e) => updatePersistence(e.target.checked)}
    className="peer sr-only"
    />
    <span className="pointer-events-none absolute h-5 w-9 rounded-full bg-muted transition-colors peer-checked:bg-primary" />
    <span className="pointer-events-none absolute left-1 size-3.5 rounded-full border border-border bg-background shadow-sm transition-transform peer-checked:translate-x-4" />
      </span>
      </label>
      </div>
      </div>
  )}
  </div>
);
}
