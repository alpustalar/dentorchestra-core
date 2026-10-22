import { getTranslations } from 'next-intl/server';

import { DataLoadingBoundary } from '@/components/loading';
import { AppointmentsPageSkeleton } from '@/features/clinical/appointment/components/appointment-skeletons';

export default async function Loading() {
  const t = await getTranslations('AppointmentCalendar');

  return (
    <DataLoadingBoundary
      isLoading
      label={t('loading')}
      fallback={<AppointmentsPageSkeleton />}
    >
      {null}
    </DataLoadingBoundary>
  );
}
