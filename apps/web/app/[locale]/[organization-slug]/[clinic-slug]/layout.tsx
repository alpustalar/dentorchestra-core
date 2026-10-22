import * as React from 'react';

import { ClinicRouteScope } from '@/components/layout/clinic-route-scope';

export default function ClinicSlugLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <ClinicRouteScope>{children}</ClinicRouteScope>;
}
