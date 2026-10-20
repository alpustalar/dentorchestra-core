import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { FinancialEventTypeSchema } from '@shared';
import { CardChargebackPlanSyncType } from '@input-type-schemas/CardChargebackPlanSyncSchema';
import { ResolveCardChargebackCommand } from './resolve-card-chargeback.command';
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
  CardChargebackNotFoundException,
  ChargebackBankAccountMismatchException,
  ChargebackReturnChannelRequiredException,
} from '@modules/finance/bank/domain/exceptions/bank.exceptions';
import { assertBankAccountUsableByClinic } from '@modules/finance/bank/domain/rules/assert-bank-account-usable';
import { TransactionManager } from '@src/infrastructure/persistence/prisma/transaction/transaction.manager';
import { TSCommandBus } from '@common/cqrs/type-safe-command-bus';
import { CriticalFailurePublisher } from '@common/observability/critical-failure.publisher';
import { RecordFinancialEventCommand } from '@modules/finance/accounting/financial-events/application/commands/record-financial-event/record-financial-event.command';
import { ChargeBackInstallmentCommand } from '@modules/finance/payment/application/commands/charge-back-installment/charge-back-installment.command';
import { FinancialEventDedupeKeys } from '@modules/finance/shared/domain/constants/financial-event-dedupe-keys.constant';
import { FINANCIAL_EVENT_SOURCE_MODULES } from '@modules/finance/shared/domain/constants/financial-event-source-modules.constant';
import {
  IPolicyFactory,
  POLICY_FACTORY,
} from '@modules/platform/policy/staff/domain/interfaces/policy-factory.interface';
import {
  IPeriodGateService,
  PERIOD_GATE_SERVICE,
} from '@modules/finance/accounting/periods/domain/services/period-gate/period-gate.service.interface';
import { Money } from '@src/domain/value-objects/money.vo';
import type { ResolveCardChargeback } from '@shared/modules/bank/types/commands';
import type { IGetContext } from '@common/decorators/get-context.decorator';

interface SyncPlanInput {
  chargeback: CardChargeback;
  data: ResolveCardChargeback;
  ctx: IGetContext;
}

/**
 * Kart itirazının sonuçlandırılması.
 *
 * Kritik finansal işlem → `outboxRun()`: durum geçişi, ödeme planı yansıması ve
 * çözüm olayı **atomik** mühürlenir. Çözüm yazılıp olay düşerse 127 hiç kapanmaz
 * ve operatör itirazı "sonuçlandı" gördüğü için bir daha girmez.
 *
 * İtiraz satırı `FOR UPDATE` kilitlenir (CLAUDE.md kural 3): çözüm bir durum
 * geçişidir ve iki eşzamanlı istek aynı itirazı farklı sonuçlarla kapatabilir;
 * kilit olmadan ikisi de "hâlâ açık" görür ve iki çözüm fişi yazılır (127 iki
 * kez kapanır, eksiye düşer).
 *
 * Plan yansıması (yalnız LOST) **hata fırlatmaz**: sağlayıcı parayı çoktan geri
 * almıştır, defter geri sarılamaz. Plana yansıtılamayan itiraz (kısmi tutar,
 * plansız çekim) kayda `planSyncStatus` olarak yazılır; elle eşleştirme
 * gerekenler için CRITICAL uyarı çıkar.
 */
@CommandHandler(ResolveCardChargebackCommand)
export class ResolveCardChargebackHandler implements ICommandHandler<
  ResolveCardChargebackCommand,
  void
> {
  constructor(
    @Inject(CARD_CHARGEBACK_COMMAND_REPOSITORY)
    private readonly chargebackRepo: ICardChargebackCommandRepository,
    @Inject(BANK_ACCOUNT_COMMAND_REPOSITORY)
    private readonly bankAccountRepo: IBankAccountCommandRepository,
    @Inject(PERIOD_GATE_SERVICE)
    private readonly periodGate: IPeriodGateService,
    @Inject(POLICY_FACTORY)
    private readonly policyFactory: IPolicyFactory,
    private readonly commandBus: TSCommandBus,
    private readonly criticalFailure: CriticalFailurePublisher,
    private readonly txManager: TransactionManager
  ) {}

  async execute(command: ResolveCardChargebackCommand): Promise<void> {
    const { chargebackId, data, ctx } = command.payload;

    const outcome = await this.txManager.outboxRun(async () => {
      const chargeback =
        await this.chargebackRepo.findByIdForUpdate(chargebackId);
      if (!chargeback) throw new CardChargebackNotFoundException(chargebackId);

      // Yetki KAYDIN kendi kliniği üzerinden verilir (istek gövdesinden değil).
      this.policyFactory
        .finance(ctx.actor, ctx.source)
        .evaluator.check((p) =>
          p.actorCanManageTargetClinic(chargeback.clinicId.value)
        )
        .orThrow('bank.card-chargeback.resolve');

      // Durum geçişi önce (yan etkisiz): ikinci çözüm hiçbir şey yazmadan reddedilir.
      if (data.outcome === 'WON') {
        // Şema (`superRefine`) `WON` için kanalı zorunlu kılar; çıkarsanan tip
        // yine de `undefined` içerir — bu kapı hem tipi daraltır hem de şemayı
        // atlayan çağrılar (başka bir handler, iç komut) için çalışma zamanı güvencesidir.
        if (!data.fundsChannel) {
          throw new ChargebackReturnChannelRequiredException();
        }

        chargeback.resolveWon({
          resolvedAt: data.resolvedAt,
          fundsChannel: data.fundsChannel,
          bankAccountId: data.bankAccountId ?? null,
          note: data.note ?? null,
          resolvedById: ctx.actor.userId,
        });

        await assertBankAccountUsableByClinic({
          bankAccountRepo: this.bankAccountRepo,
          bankAccountId: data.bankAccountId,
          clinicId: chargeback.clinicId.value,
          onClinicMismatch: (id) =>
            new ChargebackBankAccountMismatchException(id),
        });
      } else {
        chargeback.resolveLost({
          resolvedAt: data.resolvedAt,
          note: data.note ?? null,
          resolvedById: ctx.actor.userId,
        });
      }

      // Çözüm tarihi belgenin kendi tarihidir: mühürlenmiş döneme düşen kayıt
      // hiç fişlenemez (CLAUDE.md finans kuralı 1).
      await this.periodGate.assertPeriodNotSealedAt({
        clinicId: chargeback.clinicId.value,
        date: data.resolvedAt,
      });

      const planSync =
        data.outcome === 'LOST'
          ? await this.syncPlan({ chargeback, data, ctx })
          : null;

      const eventId = await this.commandBus.execute(
        new RecordFinancialEventCommand(
          {
            clinicId: chargeback.clinicId.value,
            type:
              data.outcome === 'WON'
                ? FinancialEventTypeSchema.enum.CARD_CHARGEBACK_WON
                : FinancialEventTypeSchema.enum.CARD_CHARGEBACK_LOST,
            occurredAt: data.resolvedAt,
            payload: this.buildEventPayload(chargeback),
            sourceModule: FINANCIAL_EVENT_SOURCE_MODULES.BANK,
            sourceRefId: chargeback.id.value,
            dedupeKey:
              data.outcome === 'WON'
                ? FinancialEventDedupeKeys.card_chargeback_won(
                    chargeback.id.value
                  )
                : FinancialEventDedupeKeys.card_chargeback_lost(
                    chargeback.id.value
                  ),
            performedById: ctx.actor.userId,
          },
          ctx
        )
      );

      chargeback.markResolvedPosted({ accountingEventId: eventId });
      await this.chargebackRepo.update(chargeback);

      return {
        planSyncStatus: planSync,
        clinicId: chargeback.clinicId.value,
        caseReference: chargeback.caseReference,
        paymentId: chargeback.paymentId,
        amount: chargeback.amount.toFixed(Money.PRECISION),
      };
    });

    // Uyarı transaction BİTTİKTEN sonra gönderilir: yayıncı transaction'a
    // katılmaz, işlem geri sarılırsa var olmayan bir çözüm için alarm çıkardı.
    if (outcome.planSyncStatus === 'NO_MATCHING_INSTALLMENT') {
      this.criticalFailure.publish({
        operation: 'finance.card-chargeback.plan-sync',
        severity: 'CRITICAL',
        summary:
          'Kart itirazı kaybedildi ancak tutara eşit tamamlanmış taksit bulunamadı; ödeme planı elle eşleştirilmeli.',
        errorMessage: `paymentId=${outcome.paymentId} amount=${outcome.amount}`,
        context: {
          chargebackId,
          caseReference: outcome.caseReference,
          paymentId: outcome.paymentId,
          amount: outcome.amount,
        },
        clinicId: outcome.clinicId,
        dedupeKey: `chargeback-plan-sync-unmatched:${chargebackId}`,
      });
    }
  }

  /**
   * Kaybedilen itirazı ödeme planına yansıtır: taksit `CHARGED_BACK` olur, aynı
   * tutarda telafi taksidi açılır. Sonuç kayda yazılır; hata FIRLATMAZ (bkz. sınıf
   * notu) — plana yansımayan itiraz için defter yine yazılır.
   */
  private async syncPlan(
    params: SyncPlanInput
  ): Promise<CardChargebackPlanSyncType> {
    const { chargeback, data, ctx } = params;

    // Plansız kart çekimi (hastasız ya da planı olmayan POS satışı): para POS
    // kaydında duruyor, yansıtılacak taksit yok.
    if (!chargeback.paymentId) {
      chargeback.recordPlanSync({ status: 'NOT_LINKED' });
      return 'NOT_LINKED';
    }

    const result = await this.commandBus.execute(
      new ChargeBackInstallmentCommand({
        paymentId: chargeback.paymentId,
        installmentId: chargeback.installmentId ?? undefined,
        clinicId: chargeback.clinicId.value,
        amount: chargeback.amount,
        caseReference: chargeback.caseReference,
        dueDate: data.resolvedAt,
        ctx,
      })
    );

    switch (result.outcome) {
      case 'CHARGED_BACK':
        chargeback.recordPlanSync({
          status: 'SYNCED',
          installmentId: result.installmentId,
          recoveryInstallmentId: result.recoveryInstallmentId,
        });
        return 'SYNCED';
      case 'NOT_LINKED':
        chargeback.recordPlanSync({ status: 'NOT_LINKED' });
        return 'NOT_LINKED';
      case 'NO_MATCHING_INSTALLMENT':
        chargeback.recordPlanSync({ status: 'NO_MATCHING_INSTALLMENT' });
        return 'NO_MATCHING_INSTALLMENT';
    }
  }

  /** Çözüm olayının gövdesi — kaydın o anki halinden (tutarlar kuruş ölçeğinde). */
  private buildEventPayload(chargeback: CardChargeback) {
    const base = {
      amount: chargeback.amount.toFixed(Money.PRECISION),
      currency: chargeback.currency,
      provider: chargeback.provider,
      caseReference: chargeback.caseReference,
    };

    return chargeback.status === 'WON'
      ? {
          ...base,
          // Entity WON'da kanalı zorunlu kılar; null olamaz.
          fundsChannel: chargeback.resolvedFundsChannel,
        }
      : { ...base, partyId: chargeback.partyId.value };
  }
}
