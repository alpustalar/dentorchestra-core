'use client';

import { useCurrentUser } from '@/data/auth/use-current-user';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { DateTimeManager } from '@shared/common';

type Greeting = 'welcome' | 'morning' | 'day' | 'evening' | 'night';

function getLocalGreeting(hour: number): Greeting {
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 18) return 'day';
  if (hour >= 18 && hour < 23) return 'evening';
  return 'night';
}

export function DashboardOverview() {
  const t = useTranslations('Dashboard');
  const { displayName } = useCurrentUser();
  const firstName = displayName.trim().split(/\s+/)[0] || displayName;
  const [greeting, setGreeting] = useState<Greeting>('welcome');

  useEffect(() => {
    setGreeting(
      getLocalGreeting(
        Math.floor(DateTimeManager.getDayMinutes(DateTimeManager.create()) / 60)
      )
    );
  }, []);

  return (
    <section
      className="flex flex-col gap-1"
      aria-labelledby="dashboard-heading"
    >
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <span>Workspace</span>
        <span aria-hidden="true">/</span>
        <span className="text-foreground">Genel Bakış</span>
      </div>
      <h2
        id="dashboard-heading"
        className="text-2xl font-semibold tracking-tight text-foreground"
      >
        {t(`greetings.${greeting}`)}, {firstName}
      </h2>
      <p className="max-w-2xl text-sm text-muted-foreground">
        Klinik operasyonlarınızdaki son durumu ve bugün için önemli aksiyonları
        takip edin.
      </p>
    </section>
  );
}
