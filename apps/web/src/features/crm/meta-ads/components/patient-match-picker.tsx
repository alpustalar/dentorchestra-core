'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Search } from 'lucide-react';

import { usePatientList } from '@/api/generated/patient-query/patient-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface PatientMatchPickerProps {
  clinicId: string;
  onSelect: (patient: { id: string; label: string }) => void;
  onCancel: () => void;
  disabled?: boolean;
}

/**
 * Projede hazır bir "hasta seçici" bileşeni yoktu; bu küçük arama-seç
 * bileşeni lead↔hasta eşleştirmesi için eklendi. `patientList`i 300ms
 * debounce'la çağırır, 2 karakterden kısa aramada istek atmaz.
 */
export function PatientMatchPicker({
  clinicId,
  onSelect,
  onCancel,
  disabled,
}: PatientMatchPickerProps) {
  const t = useTranslations('MetaAds');
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const canSearch = debounced.length >= 2;
  const patientsQuery = usePatientList(
    { clinicId, search: debounced, limit: 5 },
    { query: { enabled: canSearch } }
  );

  const results = canSearch ? patientsQuery.data?.data ?? [] : [];

  return (
    <div className="flex flex-col gap-2 rounded-lg border bg-muted/30 p-3">
      <div className="flex items-center gap-2">
        <Input
          autoFocus
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={t('searchPatientPlaceholder')}
          disabled={disabled}
          className="h-8 text-sm"
        />
        <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
          {t('cancel')}
        </Button>
      </div>

      {canSearch && (
        <div className="flex flex-col gap-1">
          {patientsQuery.isFetching ? (
            <p className="px-1 text-xs text-muted-foreground">
              {t('searchingPatients')}
            </p>
          ) : results.length === 0 ? (
            <p className="px-1 text-xs text-muted-foreground">
              {t('noPatientResults')}
            </p>
          ) : (
            results.map((patient) => {
              const label = [patient.firstName, patient.lastName]
                .filter(Boolean)
                .join(' ');
              return (
                <button
                  key={patient.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => onSelect({ id: patient.id, label })}
                  className="flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent disabled:opacity-50"
                >
                  <Search className="size-3.5 shrink-0 text-muted-foreground" />
                  <span className="truncate">{label}</span>
                  {patient.phone && (
                    <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                      {patient.phone}
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
