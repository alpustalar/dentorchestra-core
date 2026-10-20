import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject, Logger } from '@nestjs/common';
import { SyncInstallmentLedgerEntryCommand } from './sync-installment-ledger-entry.command';
import {
  SyncInstallmentLedgerEntryOutcome,
  SyncInstallmentLedgerEntryResponse,
} from './sync-installment-ledger-entry.response';
import { TSQueryBus } from '@common/cqrs/type-safe-query-bus';
import { TransactionManager } from '@src/infrastructure/persistence/prisma/transaction';
import { GetInstallmentForLedgerQuery } from '@modules/finance/payment/application/queries/get-installment-for-ledger/get-installment-for-ledger.query';
import {
  FINANCE_LEDGER_COMMAND_REPOSITORY,
  IFinanceLedgerCommandRepository,
} from '@modules/finance/finance-ledger/domain/repositories/finance-ledger/finance-ledger.command.repository';
import { FinanceLedgerEntity } from '@modules/finance/finance-ledger/domain/entities/finance-ledger.entity';
import {
  LedgerEntryAlreadyExistsException,
  LedgerSourceInstallmentNotFoundException,
} from '@modules/finance/finance-ledger/domain/exceptions/finance-ledger.exceptions';
import {
  ITenantScopeResolver,
  TENANT_SCOPE_RESOLVER,
} from '@modules/organization/clinic/domain/services/tenant-scope/tenant-scope.resolver.interface';
import { Money } from '@src/domain/value-objects/money.vo';
import {
  LedgerCategorySchema,
  LedgerSourceSchema,
  LedgerStatusSchema,
  LedgerTypeSchema,
} from '@shared';
import { ledgerStatusForInstallment } from '@modules/finance/finance-ledger/domain/rules/installment-ledger-status.rule';
import type { LedgerStatusType } from '@input-type-schemas/LedgerStatusSchema';
import type { InstallmentLedgerRow } from '@modules/finance/payment/domain/contracts/payment';
import { DateTimeManager } from '@shared/common/utils/date-time/date-time.manager';

@CommandHandler(SyncInstallmentLedgerEntryCommand)
export class SyncInstallmentLedgerEntryHandler
  implements
    ICommandHandler<
      SyncInstallmentLedgerEntryCommand,
      SyncInstallmentLedgerEntryResponse
    >
{
  private readonly logger = new Logger(SyncInstallmentLedgerEntryHandler.name);

  constructor(
    @Inject(FINANCE_LEDGER_COMMAND_REPOSITORY)
    private readonly ledgerRepo: IFinanceLedgerCommandRepository,
    @Inject(TENANT_SCOPE_RESOLVER)
    private readonly tenantScopeResolver: ITenantScopeResolver,
    private readonly queryBus: TSQueryBus,
    private readonly txManager: TransactionManager
  ) {}

  async execute(
    command: SyncInstallmentLedgerEntryCommand
  ): Promise<SyncInstallmentLedgerEntryResponse> {
    const { installmentId, actorId, ctx } = command.payload;

    // Kaynağın NİHAİ durumu yazma anında okunur (olay payload'ındaki durum
    // bayatlamış olabilir).
    const { data: installment } = await this.queryBus.execute(
      new GetInstallmentForLedgerQuery(installmentId, ctx)
    );

    if (!installment) {
      throw new LedgerSourceInstallmentNotFoundException(installmentId);
    }

    const expectedStatus = ledgerStatusForInstallment(installment.status);
    const existing = await this.ledgerRepo.findByInstallmentId(installmentId);

    if (!expectedStatus) {
      // Tahsil edilmemiş taksit: defterde karşılığı olmamalı. Yanlışlıkla
      // yazılmış bir kayıt varsa iptale çekilir, silinmez (iz kalır).
      if (!existing) return { outcome: 'SKIPPED' };

      const changed = existing.syncStatus(LedgerStatusSchema.enum.CANCELLED);
      if (!changed) return { outcome: 'UNCHANGED' };

      await this.txManager.run(() => this.ledgerRepo.update(existing));
      return { outcome: 'SYNCED' };
    }

    if (existing) {
      return { outcome: await this.syncExisting(existing, expectedStatus) };
    }

    return {
      outcome: await this.record({
        installment,
        expectedStatus,
        actorId: actorId ?? null,
      }),
    };
  }

  private async syncExisting(
    existing: FinanceLedgerEntity,
    expectedStatus: LedgerStatusType
  ): Promise<SyncInstallmentLedgerEntryOutcome> {
    const changed = existing.syncStatus(expectedStatus);
    if (!changed) return 'UNCHANGED';

    await this.txManager.run(() => this.ledgerRepo.update(existing));
    return 'SYNCED';
  }

  private async record({
    installment,
    expectedStatus,
    actorId,
  }: RecordLedgerEntryInput): Promise<SyncInstallmentLedgerEntryOutcome> {
    const organizationId = await this.tenantScopeResolver.resolve({
      clinicId: installment.clinicId,
    });

    const entry = FinanceLedgerEntity.create({
      organizationId,
      clinicId: installment.clinicId,
      patientId: installment.patientId,
      paymentId: installment.paymentId,
      installmentId: installment.installmentId,
      performedById: actorId,
      type: LedgerTypeSchema.enum.INCOME,
      source: LedgerSourceSchema.enum.PAYMENT_MODULE,
      category: LedgerCategorySchema.enum.TREATMENT_PAYMENT,
      money: Money.fromTrusted(installment.amount, installment.currency),
      status: expectedStatus,
      // Kaydın tarihi tahsilatın tarihidir, kaydın yazıldığı an DEĞİL: kuyruk
      // gecikir ya da iş yeniden denenirse ayın son günü alınan tahsilat
      // sonraki ayın gelirine düşüyordu.
      entryDate: installment.paidAt ?? DateTimeManager.create(),
    });

    try {
      await this.txManager.run(() => this.ledgerRepo.create(entry));
      return 'RECORDED';
    } catch (error) {
      if (!(error instanceof LedgerEntryAlreadyExistsException)) throw error;

      // Eşzamanlı yazma (olayın iki kez teslimi / telafi turu ile çakışma):
      // unique kısıt mükerreri engelledi. Yeniden okuma transaction'ın
      // DIŞINDA yapılır — unique ihlali transaction'ı abort ettiği için aynı
      // tx içinde yapılan her sorgu da hata verirdi.
      this.logger.log(
        `Cari kaydı eşzamanlı yazılmış, durum hizalanıyor: ${installment.installmentId}`
      );

      const raced = await this.ledgerRepo.findByInstallmentId(
        installment.installmentId
      );
      if (!raced) throw error;

      return this.syncExisting(raced, expectedStatus);
    }
  }
}

interface RecordLedgerEntryInput {
  installment: InstallmentLedgerRow;
  expectedStatus: LedgerStatusType;
  actorId: string | null;
}
