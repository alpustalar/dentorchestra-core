import { Module } from '@nestjs/common';
import { CreateBankAccountHandler } from './create-bank-account/create-bank-account.handler';
import { ArchiveBankAccountHandler } from './archive-bank-account/archive-bank-account.handler';
import { ImportBankStatementHandler } from './import-bank-statement/import-bank-statement.handler';
import { ReconcileStatementLineHandler } from './reconcile-statement-line/reconcile-statement-line.handler';
import { AutoMatchStatementLinesHandler } from './auto-match-statement-lines/auto-match-statement-lines.handler';
import { RecordProviderSettlementHandler } from './record-provider-settlement/record-provider-settlement.handler';
import { BankInfrastructureModule } from '@modules/finance/bank/infrastructure/infrastructure.module';
import { ClinicDomainServicesModule } from '@modules/organization/clinic/domain/services/services.module';
import { AccountingPeriodDomainServicesModule } from '@modules/finance/accounting/periods/domain/services/services.module';
import { PostingDomainServicesModule } from '@modules/finance/accounting/posting/domain/services/services.module';

export const BANK_COMMAND_HANDLERS = [
  CreateBankAccountHandler,
  ArchiveBankAccountHandler,
  ImportBankStatementHandler,
  ReconcileStatementLineHandler,
  AutoMatchStatementLinesHandler,
  RecordProviderSettlementHandler,
];

@Module({
  // Hesap kapaması üç yaprak domain-servis modülüne bağlı: kiracı kapsamı
  // (clinicId → organizationId), dönem kapısı (payout tarihi mühürlü mü) ve
  // 108 bakiye kapısı. Üçü de `assert*`/skaler sözleşmeli yaprak modüller —
  // sahiplerinin ana modülleri import edilmez (controller + handler zinciri
  // çekilmez, döngü riski doğmaz).
  imports: [
    BankInfrastructureModule,
    ClinicDomainServicesModule,
    AccountingPeriodDomainServicesModule,
    PostingDomainServicesModule,
  ],
  providers: BANK_COMMAND_HANDLERS,
  exports: BANK_COMMAND_HANDLERS,
})
export class BankCommandModule {}
