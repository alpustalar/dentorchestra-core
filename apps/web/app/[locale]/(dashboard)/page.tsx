import { KpiCards } from '@/features/analytics/components/kpi-cards';
import { RevenueChart } from '@/features/analytics/components/revenue-chart';
import { LeadsPanel } from '@/features/crm/lead/components/leads-panel';
import { AppointmentsPanel } from '@/features/clinical/appointment/components/appointments-panel';
import { OmnichannelPanel } from '@/features/messaging/components/omnichannel-panel';
import { PaymentsPanel } from './_components/payments-panel';
import { TourismPanel } from '@/features/crm/health-tourism/tourism-panel';
import { PatientsPanel } from '@/features/crm/patient/components/patients-panel';
import { OperationsPanel } from '@/features/supply/inventory/components/operations-panel';

export default function DashboardPage() {
  return (
    <div className="min-h-full bg-background">
      <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-6 p-4 md:p-6 lg:p-8">
        <section
          className="flex flex-col gap-1"
          aria-labelledby="dashboard-heading"
        >
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <span>Workspace</span>
            <span aria-hidden="true">/</span>
            <span className="text-foreground">Genel Bakış</span>
          </div>
          <h2
            id="dashboard-heading"
            className="text-2xl font-semibold tracking-tight text-foreground"
          >
            Günaydın, Zeynep
          </h2>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Klinik operasyonlarınızdaki son durumu ve bugün için önemli
            aksiyonları takip edin.
          </p>
        </section>

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
