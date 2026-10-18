'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { cn } from '@/lib/utils';

export const patientDirectory = {
  'Elif Yıldız': {
    id: 'elif-yildiz',
    protocol: 'MD-2026-0184',
    initials: 'EY',
    status: 'Aktif',
  },
  'James Miller': {
    id: 'james-miller',
    protocol: 'MD-2026-0183',
    initials: 'JM',
    status: 'Aktif',
  },
  'Ayşe Korkmaz': {
    id: 'ayse-korkmaz',
    protocol: 'MD-2026-0182',
    initials: 'AK',
    status: 'Takipte',
  },
  'Mohammed Al-Farsi': {
    id: 'mohammed-al-farsi',
    protocol: 'MD-2026-0181',
    initials: 'MA',
    status: 'Aktif',
  },
  'Sofia Rossi': {
    id: 'sofia-rossi',
    protocol: 'MD-2026-0179',
    initials: 'SR',
    status: 'Aktif',
  },
  'Deniz Arslan': {
    id: 'deniz-arslan',
    protocol: 'MD-2026-0178',
    initials: 'DA',
    status: 'Aktif',
  },
} as const;

type PatientName = keyof typeof patientDirectory;
type PatientLinkProps = {
  name: string;
  showProtocol?: boolean;
  showStatus?: boolean;
  showPhone?: boolean;
  variant?: 'compact' | 'standard' | 'detailed';
  className?: string;
};

export function PatientLink({
  name,
  showProtocol = false,
  showStatus = false,
  showPhone = false,
  variant = 'standard',
  className,
}: PatientLinkProps) {
  const params = useParams<{ locale: string }>();
  const patient = patientDirectory[name as PatientName];
  if (!patient) return <span className={className}>{name}</span>;
  return (
    <Link
      href={`/${params.locale ?? 'tr'}/patients/${patient.id}`}
      className={cn(
        'group inline-flex min-w-0 items-center gap-2 rounded-md text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring',
        className
      )}
      aria-label={`${name} hasta profilini aç`}
    >
      <span
        className={cn(
          'flex shrink-0 items-center justify-center rounded-full bg-primary/10 font-medium text-primary',
          variant === 'compact' ? 'size-7 text-[10px]' : 'size-8 text-xs'
        )}
      >
        {patient.initials}
      </span>
      <span className="min-w-0">
        <span className="block truncate font-medium text-foreground group-hover:text-primary group-hover:underline">
          {name}
        </span>
        {(showProtocol || showStatus || showPhone) && (
          <span className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
            {showProtocol && <span>{patient.protocol}</span>}
            {showPhone && <span>0532 481 22 18</span>}
            {showStatus && <span>{patient.status}</span>}
          </span>
        )}
      </span>
    </Link>
  );
}

export function patientProfilePath(locale: string, name: string) {
  const patient = patientDirectory[name as PatientName];
  return patient ? `/${locale}/patients/${patient.id}` : `/${locale}/patients`;
}
