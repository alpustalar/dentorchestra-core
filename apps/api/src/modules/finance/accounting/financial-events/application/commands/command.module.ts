import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { RecordFinancialEventHandler } from './record-financial-event/record-financial-event.handler';
import { RecordSupplierPaymentHandler } from './record-supplier-payment/record-supplier-payment.handler';
import { FinancialEventRepositoriesModule } from '@modules/finance/accounting/financial-events/infrastructure/persistence/prisma/repositories/repositories.module';
import { AccountingPeriodDomainServicesModule } from '@modules/finance/accounting/periods/domain/services/services.module';

const CommandHandlers = [
  RecordFinancialEventHandler,
  RecordSupplierPaymentHandler,
];

@Module({
  imports: [
    CqrsModule,
    FinancialEventRepositoriesModule,
    // Satıcı ödemesinin tarihi kullanıcıdan geliyor → dönem kapısı (yaprak modül).
    AccountingPeriodDomainServicesModule,
  ],
  providers: [...CommandHandlers],
  exports: [...CommandHandlers],
})
export class FinancialEventCommandModule {}
