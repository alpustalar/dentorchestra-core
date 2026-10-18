import { Inject } from '@nestjs/common';
import { Decimal } from 'decimal.js';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { CurrencySchema } from '@input-type-schemas/CurrencySchema';
import { FinancialEventTypeSchema } from '@shared';
import { RecordProviderSettlementCommand } from './record-provider-settlement.command';
import { ProviderSettlement } from '@modules/finance/bank/domain/entities/provider-settlement.entity';
import {
  IProviderSettlementCommandRepository,
  PROVIDER_SETTLEMENT_COMMAND_REPOSITORY,
} from '@modules/finance/bank/domain/repositories/provider-settlement/provider-settlement.command.repository';
import {
  BANK_ACCOUNT_COMMAND_REPOSITORY,
  IBankAccountCommandRepository,
} from '@modules/finance/bank/domain/repositories/bank-account/bank-account.command.repository';
import {
  BankAccountArchivedException,
  BankAccountNotFoundException,
  SettlementBankAccountMismatchException,
} from '@modules/finance/bank/domain/exceptions/bank.exceptions';
import { BankAccountStatusSchema } from '@input-type-schemas/BankAccountStatusSchema';
import { TransactionManager } from '@src/infrastructure/persistence/prisma/transaction/transaction.manager';
import { TSCommandBus } from '@common/cqrs/type-safe-command-bus';
import { RecordFinancialEventCommand } from '@modules/finance/accounting/financial-events/application/commands/record-financial-event/record-financial-event.command';
import { FinancialEventDedupeKeys } from '@modules/finance/shared/domain/constants/financial-event-dedupe-keys.constant';
import { FINANCIAL_EVENT_SOURCE_MODULES } from '@modules/finance/shared/domain/constants/financial-event-source-modules.constant';
import {
  IPolicyFactory,
  POLICY_FACTORY,
} from '@modules/platform/policy/staff/domain/interfaces/policy-factory.interface';
import {
  ITenantScopeResolver,
  TENANT_SCOPE_RESOLVER,
} from '@modules/organization/clinic/domain/services/tenant-scope/tenant-scope.resolver.interface';
import {
  IPeriodGateService,
  PERIOD_GATE_SERVICE,
} from '@modules/finance/accounting/periods/domain/services/period-gate/period-gate.service.interface';
import {
  FUNDS_IN_TRANSIT_GATE,
  IFundsInTransitGate,
} from '@modules/finance/accounting/posting/domain/services/funds-in-transit/funds-in-transit.gate.interface';
import { Money } from '@src/domain/value-objects/money.vo';

/**
 * Sağlayıcı hesap kapaması kaydı — 108'de bekleyen kart tahsilatlarının kapanışı.
 *
 * Kritik finansal işlem → `outboxRun()`: kayıt ile ekonomik olay **atomik**
 * mühürlenir. Kayıt yazılıp olay düşerse 108 defterde açık kalır ve operatör
 * payout'u "girilmiş" gördüğü için bir daha girmez — eksik hiç fark edilmez.
 *
 * Kapı sırası bilinçli:
 *   1. yetki (hedef klinik aktörün yönetiminde mi),
 *   2. banka hesabı (varsa) **aynı kliniğin** mi — kiracı sınırı,
 *   3. dönem kapısı (payout tarihi mühürlenmiş döneme düşüyor mu),
 *   4. 108 bakiyesi kilit altında yeterli mi (eksiye düşürme yasak),
 *   5. kayıt + olay.
 * Üçüncüden önce dördüncüye geçilmez: kilit en kısa süre tutulmalı, bu yüzden
 * kullanıcı hatasıyla reddedilecek istekler kilitten **önce** elenir.
 */
@CommandHandler(RecordProviderSettlementCommand)
export class RecordProviderSettlementHandler implements ICommandHandler<
  RecordProviderSettlementCommand,
  string
> {
  constructor(
    @Inject(PROVIDER_SETTLEMENT_COMMAND_REPOSITORY)
    private readonly settlementRepo: IProviderSettlementCommandRepository,
    @Inject(BANK_ACCOUNT_COMMAND_REPOSITORY)
    private readonly bankAccountRepo: IBankAccountCommandRepository,
    @Inject(TENANT_SCOPE_RESOLVER)
    private readonly tenantScopeResolver: ITenantScopeResolver,
    @Inject(PERIOD_GATE_SERVICE)
    private readonly periodGate: IPeriodGateService,
    @Inject(FUNDS_IN_TRANSIT_GATE)
    private readonly fundsInTransitGate: IFundsInTransitGate,
    @Inject(POLICY_FACTORY)
    private readonly policyFactory: IPolicyFactory,
    private readonly commandBus: TSCommandBus,
    private readonly txManager: TransactionManager
  ) {}

  async execute(command: RecordProviderSettlementCommand): Promise<string> {
    const { data, ctx } = command;

    // `clinicId` istek gövdesinden geliyor: kontrol olmadan başka kliniğin
    // defterine hesap kapaması yazılabilirdi (§79 ile aynı sınıf hata).
    this.policyFactory
      .finance(ctx.actor, ctx.source)
      .evaluator.check((p) => p.actorCanManageTargetClinic(data.clinicId))
      .orThrow('bank.provider-settlement.record');

    const organizationId = await this.tenantScopeResolver.resolve({
      clinicId: data.clinicId,
    });

    const grossAmount = new Decimal(data.grossAmount);
    const commissionAmount = new Decimal(data.commissionAmount);
    const netAmount = new Decimal(data.netAmount);

    return this.txManager.outboxRun(async () => {
      await this.assertBankAccountBelongsToClinic(data);

      // Payout tarihi belgenin kendi tarihidir: mühürlenmiş döneme düşen kayıt
      // hiç fişlenemez (CLAUDE.md finans kuralı 1).
      await this.periodGate.assertPeriodNotSealedAt({
        clinicId: data.clinicId,
        date: data.payoutDate,
      });

      // 108'de o kadar bekleyen para yok ise ret: fazlası kapatılırsa hesap
      // alacak bakiyesine (eksiye) düşer ve 102'ye hiç gelmemiş para girer.
      // Okuma kilit altında ve aynı transaction içinde.
      await this.fundsInTransitGate.assertCanSettle({
        clinicId: data.clinicId,
        grossAmount,
      });

      const settlement = ProviderSettlement.record({
        clinicId: data.clinicId,
        organizationId,
        provider: data.provider,
        reference: data.reference,
        payoutDate: data.payoutDate,
        grossAmount,
        commissionAmount,
        netAmount,
        currency: CurrencySchema.enum.TRY,
        bankAccountId: data.bankAccountId ?? null,
        note: data.note ?? null,
        recordedById: ctx.actor.userId,
      });

      const created = await this.settlementRepo.create(settlement);

      const eventId = await this.commandBus.execute(
        new RecordFinancialEventCommand(
          {
            clinicId: created.clinicId.value,
            type: FinancialEventTypeSchema.enum.PROVIDER_SETTLEMENT_RECEIVED,
            occurredAt: created.payoutDate,
            payload: {
              grossAmount: created.grossAmount.toFixed(Money.PRECISION),
              netAmount: created.netAmount.toFixed(Money.PRECISION),
              commissionAmount: created.commissionAmount.toFixed(
                Money.PRECISION
              ),
              currency: created.currency,
              provider: created.provider,
              reference: created.reference,
            },
            sourceModule: FINANCIAL_EVENT_SOURCE_MODULES.BANK,
            sourceRefId: created.id.value,
            dedupeKey: FinancialEventDedupeKeys.provider_settlement(
              created.id.value
            ),
            performedById: ctx.actor.userId,
          },
          ctx
        )
      );

      created.markAsPostedToAccounting({ accountingEventId: eventId });
      await this.settlementRepo.update(created);

      return created.id.value;
    });
  }

  /**
   * Banka hesabı opsiyoneldir ama verildiyse **aynı kliniğin** olmak zorundadır:
   * başka kiracının hesabı seçilirse kayıt o hesabın mutabakatına karışır.
   */
  private async assertBankAccountBelongsToClinic(data: {
    bankAccountId?: string | null;
    clinicId: string;
  }): Promise<void> {
    if (!data.bankAccountId) return;

    const account = await this.bankAccountRepo.findById(data.bankAccountId);
    if (!account) {
      throw new BankAccountNotFoundException(data.bankAccountId);
    }

    if (account.clinicId.value !== data.clinicId) {
      throw new SettlementBankAccountMismatchException(data.bankAccountId);
    }

    if (account.status === BankAccountStatusSchema.enum.ARCHIVED) {
      throw new BankAccountArchivedException(account.id.value);
    }
  }
}
