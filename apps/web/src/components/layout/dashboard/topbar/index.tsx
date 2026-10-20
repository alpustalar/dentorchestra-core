'use client';

import { useState } from 'react';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { TopbarTitle } from './topbar-title';
import { ClinicSelector } from './clinic-selector';
import { GlobalSearch } from './global-search';
import { SettingsMenu } from './settings-menu';
import { NotificationBell } from './notification-bell';
import { ProfileSheet } from './profile-sheet';
import { useTopbarSettings } from '@/components/layout/dashboard/hooks/use-topbar-settings';
import { RoleSwitcher } from './role-switcher';

export function Topbar() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const {
    accent,
    setAccent,
    contrast,
    setContrast,
    persistSettings,
    updatePersistence,
  } = useTopbarSettings();

  return (
    <div className="flex h-16 w-full items-center gap-3 border-b border-border/80 bg-background/95 px-4 md:px-6 shrink-0">
      {/* Mobil Sidebar Tetikleyici */}
      <SidebarTrigger className="lg:hidden shrink-0" />

      {/* Sayfa Başlığı ve Tarih */}
      <TopbarTitle />

      {/* Klinik Seçici */}
      <ClinicSelector />
      <RoleSwitcher />

      {/* Sağ Taraf */}
      <div className="ml-auto flex items-center gap-2">
        <GlobalSearch />

        <SettingsMenu
          open={settingsOpen}
          onOpenChange={setSettingsOpen}
          accent={accent}
          setAccent={setAccent}
          contrast={contrast}
          setContrast={setContrast}
          persistSettings={persistSettings}
          updatePersistence={updatePersistence}
        />

        <NotificationBell />

        <ProfileSheet />
      </div>
    </div>
  );
}
