'use client';

import { ShieldCheck } from 'lucide-react';
import { useTranslations } from 'next-intl';

export default function PlatformAdministrationPage() {
  const t = useTranslations('Common.platformAdministration');

  return (
    <section className="p-6 md:p-8">
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <ShieldCheck className="size-5" />
          </div>
          <div>
            <h1 className="text-xl font-semibold">{t('title')}</h1>
            <p className="text-sm text-muted-foreground">{t('description')}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
