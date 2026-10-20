'use client';

import { useState } from 'react';
import { UserRound } from 'lucide-react';
import { useAuth } from '@/data/auth/auth-context';
import { useCurrentUser } from '@/data/auth/use-current-user';
import { clinics } from '@/features/organization/clinic/data/mock-clinic';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';

export function ProfileSheet() {
  const [profileOpen, setProfileOpen] = useState(false);
  const { claims, selectedClinicId } = useAuth();
  const { displayName, email, initials } = useCurrentUser();
  const activeClinic = clinics.find((clinic) => clinic.id === selectedClinicId);

  return (
    <Sheet open={profileOpen} onOpenChange={setProfileOpen}>
      <SheetTrigger
        render={
          <button
            type="button"
            aria-label="Profil panelini aç"
            className="flex h-9 items-center gap-2 rounded-lg border border-border bg-card px-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
          />
        }
      >
        <span className="flex size-6 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">
          {initials}
        </span>
        <span className="hidden md:inline">{displayName}</span>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader className="border-b border-border px-5 py-5">
          <SheetTitle>Profilim</SheetTitle>
          <SheetDescription>
            Hesap bilgilerinizi ve çalışma tercihlerinizi yönetin.
          </SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-6 overflow-y-auto px-5 py-6">
          <div className="flex items-center gap-4">
            <div className="flex size-16 items-center justify-center rounded-full bg-primary text-lg font-semibold text-primary-foreground">
              {initials}
            </div>
            <div>
              <p className="font-semibold text-foreground">{displayName}</p>
              <p className="text-sm text-muted-foreground">{claims.role.name}</p>
            </div>
          </div>
          <div className="grid gap-3 rounded-xl border border-border bg-card p-4">
            <div>
              <p className="text-xs font-medium text-muted-foreground">
                E-posta
              </p>
              <p className="mt-1 text-sm text-foreground">
                {email || '—'}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">
                Aktif klinik
              </p>
              <p className="mt-1 text-sm text-foreground">
                {activeClinic?.name ?? 'Tüm klinikler'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/40 p-4">
            <UserRound className="size-4 text-primary" />
            <p className="text-sm text-muted-foreground">
              Profil ayarları yakında burada olacak.
            </p>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
