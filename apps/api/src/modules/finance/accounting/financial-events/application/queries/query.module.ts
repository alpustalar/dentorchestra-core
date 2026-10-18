import { Module } from '@nestjs/common';
import { GetFinancialEventsHandler } from './get-financial-events/get-financial-events.handler';
import { GetFinancialEventByIdHandler } from './get-financial-event-by-id/get-financial-event-by-id.handler';
import { GetUnpostedFinancialEventsHandler } from './get-unposted-financial-events/get-unposted-financial-events.handler';
import { GetClinicsWithUnpostedFinancialEventsHandler } from './get-clinics-with-unposted-financial-events/get-clinics-with-unposted-financial-events.handler';
import { FindExistingFinancialEventRefsHandler } from './find-existing-financial-event-refs/find-existing-financial-event-refs.handler';
import { FindExistingFinancialEventDedupeKeysHandler } from './find-existing-financial-event-dedupe-keys/find-existing-financial-event-dedupe-keys.handler';
import { FinancialEventRepositoriesModule } from '@modules/finance/accounting/financial-events/infrastructure/persistence/prisma/repositories/repositories.module';

const QueryHandlers = [
  GetFinancialEventsHandler,
  GetFinancialEventByIdHandler,
  GetUnpostedFinancialEventsHandler,
  GetClinicsWithUnpostedFinancialEventsHandler,
  FindExistingFinancialEventRefsHandler,
  FindExistingFinancialEventDedupeKeysHandler,
];

@Module({
  imports: [FinancialEventRepositoriesModule],
  providers: [...QueryHandlers],
  exports: [...QueryHandlers],
})
export class FinancialEventQueryModule {}
