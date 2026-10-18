import { Module } from '@nestjs/common';
import { FinancialEventQueryController } from '@modules/finance/accounting/financial-events/presentation/http/controllers/financial-event.query.controller';
import { FinancialEventCommandController } from '@modules/finance/accounting/financial-events/presentation/http/controllers/financial-event.command.controller';

@Module({
  controllers: [FinancialEventQueryController, FinancialEventCommandController],
})
export class FinancialEventPresentationModule {}
