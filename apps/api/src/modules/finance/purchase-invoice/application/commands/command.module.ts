import { Module } from '@nestjs/common';
import { RecordPurchaseInvoiceHandler } from './record-purchase-invoice/record-purchase-invoice.handler';
import { MatchPurchaseInvoiceHandler } from './match-purchase-invoice/match-purchase-invoice.handler';
import { UnmatchPurchaseInvoiceHandler } from './unmatch-purchase-invoice/unmatch-purchase-invoice.handler';
import { CancelPurchaseInvoiceHandler } from './cancel-purchase-invoice/cancel-purchase-invoice.handler';
import { PurchaseInvoiceInfrastructureModule } from '@modules/finance/purchase-invoice/infrastructure/infrastructure.module';
import { AccountingPeriodDomainServicesModule } from '@modules/finance/accounting/periods/domain/services/services.module';

const CommandHandlers = [
  RecordPurchaseInvoiceHandler,
  MatchPurchaseInvoiceHandler,
  UnmatchPurchaseInvoiceHandler,
  CancelPurchaseInvoiceHandler,
];

@Module({
  imports: [
    PurchaseInvoiceInfrastructureModule,
    // Fatura tarihi kullanıcıdan geliyor → dönem kapısı (yaprak modül).
    AccountingPeriodDomainServicesModule,
  ],
  providers: [...CommandHandlers],
})
export class PurchaseInvoiceCommandModule {}
