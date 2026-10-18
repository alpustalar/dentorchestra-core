'use client';

import { ArrowLeft, CalendarDays, MoreHorizontal, Pencil } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';

export function PatientActions({
  type,
}: {
  type: 'back-button' | 'header-actions';
}) {
  const router = useRouter();

  if (type === 'back-button') {
    return (
      <Button
        variant="ghost"
        size="sm"
        onClick={() => router.push('../patients')}
      >
        <ArrowLeft className="me-2 size-4" />
        Hastalara dön
      </Button>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button onClick={() => router.push('../appointments')}>
        <CalendarDays className="me-2 size-4" />
        Randevu oluştur
      </Button>
      <Button variant="outline">
        <Pencil className="me-2 size-4" />
        Bilgileri düzenle
      </Button>
      <Button variant="ghost" size="icon" aria-label="Daha fazla hasta işlemi">
        <MoreHorizontal className="size-4" />
      </Button>
    </div>
  );
}