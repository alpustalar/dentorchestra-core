'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { type ClinicKey, clinics } from '@/lib/data';
import { cn } from '@/lib/utils';

export function ClinicSelector() {
  const [clinic, setClinic] = useState<ClinicKey>('all');
  const [open, setOpen] = useState(false);
  const current = clinics.find((c) => c.key === clinic);

  return (
    <div className="relative ml-2">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted cursor-pointer transition-colors"
      >
        <span className="h-2 w-2 rounded-full bg-primary shrink-0" />
        <span className="truncate">{current?.label}</span>
        <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
      </button>

      {open && (
        <div className="absolute left-0 top-11 z-30 w-52 overflow-hidden rounded-lg border border-border bg-popover p-1 shadow-lg">
          {clinics.map((c) => (
            <button
              key={c.key}
              onClick={() => {
                setClinic(c.key);
                setOpen(false);
              }}
              className={cn(
                'flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-muted cursor-pointer transition-colors',
                c.key === clinic
                  ? 'font-medium text-primary'
                  : 'text-popover-foreground'
              )}
            >
              {c.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
