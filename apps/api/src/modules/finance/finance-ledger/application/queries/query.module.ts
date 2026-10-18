import { GetPatientFinanceSummaryHandler } from './get-patient-finance-summary/get-patient-finance-summary.handler';
import { GetLedgerByPatientIdHandler } from './get-ledger-by-patient-id/get-ledger-by-patient-id.handler';
import { GetLedgerByClinicIdHandler } from './get-ledger-by-clinic-id/get-ledger-by-clinic-id.handler';
import { Module } from '@nestjs/common';
import { GetClinicFinanceSummaryHandler } from './get-clinic-finance-summary/get-clinic-finance-summary.handler';
import { GetRevenueByPatientsHandler } from './get-revenue-by-patients/get-revenue-by-patients.handler';
import { FindLedgerMismatchesHandler } from './find-ledger-mismatches/find-ledger-mismatches.handler';
import { FinanceLedgerRepositoryModule } from '@modules/finance/finance-ledger/infrastructure/persistence/prisma/repositories/finance-ledger/finance-ledger.repository.module';

const QueryHandlers = [
  GetPatientFinanceSummaryHandler,
  GetLedgerByPatientIdHandler,
  GetLedgerByClinicIdHandler,
  GetClinicFinanceSummaryHandler,
  GetRevenueByPatientsHandler,
  FindLedgerMismatchesHandler,
];

@Module({
  imports: [FinanceLedgerRepositoryModule],
  providers: [...QueryHandlers],
  exports: [...QueryHandlers],
})
export class FinanceLedgerQueryModule {}
