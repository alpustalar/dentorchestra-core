import { KpiCards } from '@/features/analytics/components/kpi-cards';
import { RevenueChart } from '@/features/analytics/components/revenue-chart';
import { LeadsPanel } from '@/features/crm/lead/components/leads-panel';
import { AppointmentsPanel } from '@/features/clinical/appointment/components/appointments-panel';
import { OmnichannelPanel } from '@/features/messaging/components/omnichannel-panel';
import { TourismPanel } from '@/features/crm/health-tourism/tourism-panel';
import { PatientsPanel } from '@/features/crm/patient/components/patients-panel';
import { OperationsPanel } from '@/features/supply/inventory/components/operations-panel';
import { DashboardOverview } from '@/features/analytics/components/dashboard-overview';
import { PaymentsPanel } from '@/features/finance/payment/components/payments-panel';

export default function DashboardPage() {
  return (
    <div className="min-h-full bg-background">
      <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-6 p-4 md:p-6 lg:p-8">
        <DashboardOverview />

        <div className="flex flex-col gap-5">
          <KpiCards />

          <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
            <RevenueChart />
            <LeadsPanel />
          </div>

          <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
            <AppointmentsPanel />
            <OmnichannelPanel />
          </div>

          <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
            <PaymentsPanel />
          </div>

          <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
            <TourismPanel />
            <PatientsPanel />
            <OperationsPanel />
          </div>
        </div>
      </div>
    </div>
  );
}
