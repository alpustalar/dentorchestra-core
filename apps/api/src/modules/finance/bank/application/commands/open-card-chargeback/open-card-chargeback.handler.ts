import { Inject } from '@nestjs/common';
import { Decimal } from 'decimal.js';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { FinancialEventTypeSchema, PartyRoleSchema } from '@shared';
import PosTransactionKindSchema from '@input-type-schemas/PosTransactionKindSchema';
import PosTransactionStatusSchema from '@input-type-schemas/PosTransactionStatusSchema';
import InstallmentStatusSchema from '@input-type-schemas/InstallmentStatusSchema';
import CardChargebackSourceSchema from '@input-type-schemas/CardChargebackSourceSchema';
import ChargebackFundsChannelSchema from '@input-type-schemas/ChargebackFundsChannelSchema';
import { CurrencySchema } from '@input-type-schemas/CurrencySchema';
import { SettlementProviderType } from '@input-type-schemas/SettlementProviderSchema';
import { OpenCardChargebackCommand } from './open-card-chargeback.command';
import { CardChargeback } from '@modules/finance/bank/domain/entities/card-chargeback.entity';
import {
  CARD_CHARGEBACK_COMMAND_REPOSITORY,
  ICardChargebackCommandRepository,
} from '@modules/finance/bank/domain/repositories/card-chargeback/card-chargeback.repository';
import {
  BANK_ACCOUNT_COMMAND_REPOSITORY,
  IBankAccountCommandRepository,
} from '@modules/finance/bank/domain/repositories/bank-account/bank-account.command.repository';
import {
  ChargebackBankAccountMismatchException,
  ChargebackCurrencyNotSupportedException,
  ChargebackExceedsCollectionException,
  ChargebackSourceClinicMismatchException,
  ChargebackSourceNotChargeableException,
  ChargebackSourceNotFoundException,
  ChargebackSourceNotInLedgerException,
  ChargebackSourcePatientRequiredException,
} from '@modules/finance/bank/domain/exceptions/bank.exceptions';
import { assertBankAccountUsableByClinic } from '@modules/finance/bank/domain/rules/assert-bank-account-usable';
import {
  CHARGEBACK_PROVIDER_BY_POS_PROVIDER,
  CHARGEBACK_PROVIDER_ONLINE,
} from '@modules/finance/bank/domain/constants/card-chargeback-provider.constant';
import { TransactionManager } from '@src/infrastructure/persistence/prisma/transaction/transaction.manager';
import { TSCommandBus } from '@common/cqrs/type-safe-command-bus';
import { TSQueryBus } from '@common/cqrs/type-safe-query-bus';
import { ExecutionContextFactory } from '@src/domain/common/execution/execution-context.factory';
import { EnsurePartyForPatientCommand } from '@modules/finance/party/application/commands/ensure-party-for-patient/ensure-party-for-patient.command';
import { RecordFinancialEventCommand } from '@modules/finance/accounting/financial-events/application/commands/record-financial-event/record-financial-event.command';
import { GetPosTransactionByIdQuery } from '@modules/finance/pos/physical/application/queries/get-pos-transaction-by-id/get-pos-transaction-by-id.query';
import { GetInstallmentForLedgerQuery } from '@modules/finance/payment/application/queries/get-installment-for-ledger/get-installment-for-ledger.query';
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
import {
  FINANCIAL_EVENT_PRESENCE_GUARD,
  IFinancialEventPresenceGuard,
} from '@modules/finance/accounting/financial-events/domain/services/event-presence/event-presence.guard.interface';
import {
  IPosCardCollectionService,
  POS_CARD_COLLECTION_SERVICE,
} from '@modules/finance/pos/physical/domain/services/pos-card-collection/pos-card-collection.service.interface';
import {
  IPaymentCollectionService,
  PAYMENT_COLLECTION_SERVICE,
} from '@modules/finance/payment/domain/services/payment-collection/payment-collection.service.interface';
import { Money } from '@src/domain/value-objects/money.vo';
import type { OpenCardChargeback } from '@shared/modules/bank/types/commands';
import type { IGetContext } from '@common/decorators/get-context.decorator';

/**
 * İtiraz edilen tahsilatın **değişmeyen olguları** + defterdeki kanıtının
 * idempotency anahtarı. Bir kaynaktan (POS işlemi / sanal POS taksidi) türer.
 */
interface ChargebackSourceFacts {
  patientId: string;
  paymentId: string | null;
  provider: SettlementProviderType;
  /** Tahsilatın `PAYMENT_RECEIVED` olayının anahtarı — defterde yazıldığının kanıtı. */
  ledgerDedupeKey: string;
}

/**
 * Kart itirazı açılışı: sağlayıcı kart sahibinin itirazı üzerine parayı kesti.
 *
 * Kritik finansal işlem → `outboxRun()`: kayıt ile ekonomik olay **atomik**
 * mühürlenir. Kayıt yazılıp olay düşerse 127 hiç dolmaz, 108'de olmayan para
 * kalır ve operatör itirazı "girilmiş" gördüğü için bir daha girmez.
 *
 * Kapı sırası bilinçli — kullanıcı hatasıyla reddedilecek istekler kilitten
 * ÖNCE elenir, kilit en kısa süre tutulur:
 *   1. yetki (hedef klinik aktörün yönetiminde mi),
 *   2. kaynağın değişmeyen olguları (kilitsiz; kiracı, tür, para birimi, hasta),
 *   3. ── transaction ──
 *   4. kaynak kilidi + geri alınabilir tutar (iade/iptal ile aynı satır kilidi),
 *   5. tahsilat defterde yazılı mı,
 *   6. kümülatif tavan (tahsilat − iade/iptal − aktif itirazlar),
 *   7. banka hesabı (varsa) aynı kliniğin mi,
 *   8. dönem kapısı (paranın kesildiği gün mühürlü mü),
 *   9. 108 bakiyesi kilit altında yeterli mi (yalnız FUNDS_IN_TRANSIT kanalında),
 *  10. cari garantisi → kayıt → olay.
 *
 * Para geri götüren her yol (iade, iptal, ters ibraz) AYNI kaynak satırını
 * kilitler ve aynı kümülatif tavana bakar; biri diğerini bilmiyorsa kart
 * sahibine para iki kez gider.
 */
@CommandHandler(OpenCardChargebackCommand)
export class OpenCardChargebackHandler implements ICommandHandler<
  OpenCardChargebackCommand,
  string
> {
  constructor(
    @Inject(CARD_CHARGEBACK_COMMAND_REPOSITORY)
    private readonly chargebackRepo: ICardChargebackCommandRepository,
    @Inject(BANK_ACCOUNT_COMMAND_REPOSITORY)
    private readonly bankAccountRepo: IBankAccountCommandRepository,
    @Inject(TENANT_SCOPE_RESOLVER)
    private readonly tenantScopeResolver: ITenantScopeResolver,
    @Inject(PERIOD_GATE_SERVICE)
    private readonly periodGate: IPeriodGateService,
    @Inject(FUNDS_IN_TRANSIT_GATE)
    private readonly fundsInTransitGate: IFundsInTransitGate,
    @Inject(FINANCIAL_EVENT_PRESENCE_GUARD)
    private readonly presenceGuard: IFinancialEventPresenceGuard,
    @Inject(POS_CARD_COLLECTION_SERVICE)
    private readonly posCollection: IPosCardCollectionService,
    @Inject(PAYMENT_COLLECTION_SERVICE)
    private readonly paymentCollection: IPaymentCollectionService,
    @Inject(POLICY_FACTORY)
    private readonly policyFactory: IPolicyFactory,
    private readonly commandBus: TSCommandBus,
    private readonly queryBus: TSQueryBus,
    private readonly txManager: TransactionManager
  ) {}

  async execute(command: OpenCardChargebackCommand): Promise<string> {
    const { data, ctx } = command;

    // `clinicId` istek gövdesinden geliyor: kontrol olmadan başka kliniğin
    // defterine itiraz yazılabilirdi (§79 ile aynı sınıf hata).
    this.policyFactory
      .finance(ctx.actor, ctx.source)
      .evaluator.check((p) => p.actorCanManageTargetClinic(data.clinicId))
      .orThrow('bank.card-chargeback.open');

    const organizationId = await this.tenantScopeResolver.resolve({
      clinicId: data.clinicId,
    });

    const source = await this.resolveSource({ data, ctx });

    const amount = new Decimal(data.amount);
    const feeAmount = new Decimal(data.feeAmount);
    const isFundsInTransit =
      data.fundsChannel === ChargebackFundsChannelSchema.enum.FUNDS_IN_TRANSIT;

    return this.txManager.outboxRun(async () => {
      // Kaynak satırı kilitle + geri alınabilir tutarı oku (tek atomik adım):
      // iade/iptal handler'ları aynı satırı kilitler, yani üç yol sıraya girer.
      const reversible =
        data.sourceType === CardChargebackSourceSchema.enum.POS_TRANSACTION
          ? await this.posCollection.lockAndGetReversibleAmount({
              posTransactionId: data.sourceId,
            })
          : await this.paymentCollection.lockAndGetCollectedAmount({
              installmentId: data.sourceId,
            });

      // Defterde olmayan bir tahsilatı geri almak, gelir eksiği değil OLMAYAN
      // PARANIN düşülmesi olurdu.
      await this.presenceGuard.assertRecorded(
        { clinicId: data.clinicId, dedupeKey: source.ledgerDedupeKey },
        new ChargebackSourceNotInLedgerException({
          sourceType: data.sourceType,
          sourceId: data.sourceId,
        })
      );

      // Kümülatif tavan: tahsilat − iade/iptal − aktif itirazlar. Aşılırsa aynı
      // para üç kez (iade + itiraz + itiraz) düşülürdü.
      const active = await this.chargebackRepo.sumActiveBySource({
        sourceType: data.sourceType,
        sourceId: data.sourceId,
      });
      if (active.plus(amount).greaterThan(reversible)) {
        const available = Decimal.max(reversible.minus(active), 0);
        throw new ChargebackExceedsCollectionException({
          reversible: reversible.toFixed(Money.PRECISION),
          activeChargebacks: active.toFixed(Money.PRECISION),
          requested: amount.toFixed(Money.PRECISION),
          available: available.toFixed(Money.PRECISION),
        });
      }

      await assertBankAccountUsableByClinic({
        bankAccountRepo: this.bankAccountRepo,
        bankAccountId: data.bankAccountId,
        clinicId: data.clinicId,
        onClinicMismatch: (id) =>
          new ChargebackBankAccountMismatchException(id),
      });

      // Paranın kesildiği gün belgenin kendi tarihidir: mühürlenmiş döneme düşen
      // kayıt hiç fişlenemez (CLAUDE.md finans kuralı 1).
      await this.periodGate.assertPeriodNotSealedAt({
        clinicId: data.clinicId,
        date: data.openedAt,
      });

      // Sağlayıcıdaki bekleyen bakiyeden kesildiyse: 108'de o kadar para yoksa ret.
      // Fazlası kesilirse 108 alacak bakiyesine (eksiye) düşer ve fiş yine dengeli
      // olduğu için hata sessiz kalır (§85). Banka kanalında 108'e dokunulmaz.
      if (isFundsInTransit) {
        await this.fundsInTransitGate.assertCanSettle({
          clinicId: data.clinicId,
          grossAmount: amount.plus(feeAmount),
        });
      }

      // Hasta carisi açılışta garanti edilir: kaybedilince `B 120` bu cariye
      // yazılır ve 120 `requiresParty` taşıdığı için carisiz fiş postlanamaz.
      const { partyId } = await this.commandBus.execute(
        new EnsurePartyForPatientCommand(
          source.patientId,
          data.clinicId,
          PartyRoleSchema.enum.CUSTOMER,
          ExecutionContextFactory.createInternal()
        )
      );

      const chargeback = CardChargeback.open({
        clinicId: data.clinicId,
        organizationId,
        provider: source.provider,
        caseReference: data.caseReference,
        sourceType: data.sourceType,
        sourceId: data.sourceId,
        paymentId: source.paymentId,
        patientId: source.patientId,
        partyId,
        amount,
        feeAmount,
        currency: CurrencySchema.enum.TRY,
        openedAt: data.openedAt,
        openedFundsChannel: data.fundsChannel,
        openedBankAccountId: data.bankAccountId ?? null,
        evidenceDueAt: data.evidenceDueAt ?? null,
        note: data.note ?? null,
        recordedById: ctx.actor.userId,
      });

      const created = await this.chargebackRepo.create(chargeback);

      const eventId = await this.commandBus.execute(
        new RecordFinancialEventCommand(
          {
            clinicId: created.clinicId.value,
            type: FinancialEventTypeSchema.enum.CARD_CHARGEBACK_OPENED,
            occurredAt: created.openedAt,
            payload: {
              amount: created.amount.toFixed(Money.PRECISION),
              feeAmount: created.feeAmount.toFixed(Money.PRECISION),
              fundsChannel: created.openedFundsChannel,
              currency: created.currency,
              provider: created.provider,
              caseReference: created.caseReference,
            },
            sourceModule: FINANCIAL_EVENT_SOURCE_MODULES.BANK,
            sourceRefId: created.id.value,
            dedupeKey: FinancialEventDedupeKeys.card_chargeback_opened(
              created.id.value
            ),
            performedById: ctx.actor.userId,
          },
          ctx
        )
      );

      created.markOpenedPosted({ accountingEventId: eventId });
      await this.chargebackRepo.update(created);

      return created.id.value;
    });
  }

  /**
   * Kaynağın **değişmeyen olgularını** toplar (hasta, ödeme planı, sağlayıcı,
   * para birimi) ve kiracı/tür kapılarını geçirir. Kilitsiz okumadır: burada
   * okunan hiçbir alan sonradan değişmez (SUCCESS bir satışın hastası, planı,
   * sağlayıcısı ve tutarı sabittir). Kararı besleyen DEĞİŞKEN durum (canlı
   * iadeler, iptal) kilit altında ayrıca okunur.
   */
  private async resolveSource(params: {
    data: OpenCardChargeback;
    ctx: IGetContext;
  }): Promise<ChargebackSourceFacts> {
    const { data, ctx } = params;
    const ref = { sourceType: data.sourceType, sourceId: data.sourceId };

    if (data.sourceType === CardChargebackSourceSchema.enum.POS_TRANSACTION) {
      const { data: tx } = await this.queryBus.execute(
        new GetPosTransactionByIdQuery(data.sourceId, ctx)
      );
      if (!tx) throw new ChargebackSourceNotFoundException(ref);

      if (tx.clinicId !== data.clinicId) {
        throw new ChargebackSourceClinicMismatchException(ref);
      }
      if (
        tx.kind !== PosTransactionKindSchema.enum.SALE ||
        tx.status !== PosTransactionStatusSchema.enum.SUCCESS
      ) {
        throw new ChargebackSourceNotChargeableException({
          ...ref,
          reason: `işlem türü=${tx.kind}, durumu=${tx.status}; yalnız başarılı SATIŞ itiraz edilebilir`,
        });
      }
      this.assertTry(tx.currency);
      if (!tx.patientId) {
        // Hastasız kart çekimi deftere hiç köprülenmez (köprü hastaya bağlı).
        throw new ChargebackSourcePatientRequiredException(ref);
      }

      return {
        patientId: tx.patientId,
        paymentId: tx.paymentId,
        provider: CHARGEBACK_PROVIDER_BY_POS_PROVIDER[tx.provider],
        ledgerDedupeKey: FinancialEventDedupeKeys.payment_received_pos(tx.id),
      };
    }

    // Sanal POS: kaynak, tahsil edilmiş taksittir.
    // Not: bu iç sorgu kiracı kapsamı kontrol ETMEZ (bkz. handler notu); kiracı
    // kapısı aşağıdaki `clinicId` eşitliğidir.
    const { data: installment } = await this.queryBus.execute(
      new GetInstallmentForLedgerQuery(data.sourceId, ctx)
    );
    if (!installment) throw new ChargebackSourceNotFoundException(ref);

    if (installment.clinicId !== data.clinicId) {
      throw new ChargebackSourceClinicMismatchException(ref);
    }
    if (installment.status !== InstallmentStatusSchema.enum.COMPLETED) {
      throw new ChargebackSourceNotChargeableException({
        ...ref,
        reason: `taksit durumu=${installment.status}; yalnız tahsil edilmiş taksit itiraz edilebilir`,
      });
    }
    this.assertTry(installment.currency);

    return {
      patientId: installment.patientId,
      paymentId: installment.paymentId,
      provider: CHARGEBACK_PROVIDER_ONLINE,
      ledgerDedupeKey: FinancialEventDedupeKeys.payment_received(
        installment.installmentId
      ),
    };
  }

  /** v1 yalnız TRY: yabancı para itirazı kur farkı üretir (§88 ertelemesi). */
  private assertTry(currency: string): void {
    if (currency !== CurrencySchema.enum.TRY) {
      throw new ChargebackCurrencyNotSupportedException(currency);
    }
  }
}
