'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useAuth } from '@/lib/auth';

/**
 * Faz 1'in canlı kanıtı: bu kart yalnız Firebase girişi → çerez → `Bearer`
 * başlığı → `AuthGuard` → `/me/context` zincirinin **tamamı** çalışıyorsa
 * dolar. Faz 2'de yerini gerçek panel bileşenleri alacak.
 */
export function DashboardOverview() {
  const { actor } = useAuth();

  if (!actor) return null;

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Oturum</CardTitle>
          <CardDescription>{actor.email}</CardDescription>
        </CardHeader>
        <CardContent className="text-muted-foreground grid gap-1 text-sm">
          <Row label="Klinik" value={actor.clinicId ?? '—'} />
          <Row label="Organizasyon" value={actor.organizationId ?? '—'} />
          <Row
            label="Yönetilen klinik"
            value={String(actor.managedClinics.length)}
          />
          <Row label="Rol önceliği" value={String(actor.rolePriority)} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Yetkinlikler</CardTitle>
          <CardDescription>
            {actor.rolePriority >= 100
              ? 'Rol önceliği 100+ — tüm yetkinlik kontrolleri atlanıyor.'
              : `${actor.capabilities.length} yetkinlik`}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-1.5">
          {actor.capabilities.slice(0, 24).map((capability) => (
            <span
              key={capability}
              className="bg-muted rounded-md px-2 py-0.5 font-mono text-xs"
            >
              {capability}
            </span>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span>{label}</span>
      <span className="text-foreground truncate font-mono text-xs">
        {value}
      </span>
    </div>
  );
}
