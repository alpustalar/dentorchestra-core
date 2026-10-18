'use client';

import * as React from 'react';
import DashboardContent from '@/components/layout/dashboard';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <DashboardContent>{children}</DashboardContent>;
}
