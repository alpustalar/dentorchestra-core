'use client';

import type { useTranslations } from 'next-intl';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ClipboardPaste, Upload } from 'lucide-react';

import { buttonVariants } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { cn } from '@/lib/utils';

type Props = {
  t: ReturnType<typeof useTranslations>;
  bankAccountId: string;
  showAdvancedPaste: boolean;
  onToggleAdvancedPaste: () => void;
};

export function BankStatementImportCard({
  t,
  bankAccountId,
  showAdvancedPaste,
  onToggleAdvancedPaste,
}: Props) {
  const pathname = usePathname();

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('importTitle')}</CardTitle>
        <CardDescription>{t('importDescription')}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        <Link
          href={`${pathname}/import-csv?bankAccountId=${encodeURIComponent(bankAccountId)}`}
          className={cn(buttonVariants({ variant: 'default' }))}
        >
          <Upload className="size-4" aria-hidden="true" />
          {t('importWizard.triggerButton')}
        </Link>
        <button
          type="button"
          className={cn(buttonVariants({ variant: 'outline' }))}
          onClick={onToggleAdvancedPaste}
          aria-expanded={showAdvancedPaste}
        >
          <ClipboardPaste className="size-4" aria-hidden="true" />
          {showAdvancedPaste
            ? t('importWizard.advancedPasteToggleHide')
            : t('importWizard.advancedPasteToggleShow')}
        </button>
      </CardContent>
    </Card>
  );
}
