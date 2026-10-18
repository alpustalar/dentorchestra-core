import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject, Logger } from '@nestjs/common';
import { ProcessSubscriptionRenewalsCommand } from './process-subscription-renewals.command';
import {
  BILLING_ADAPTER,
  IBillingAdapter,
  PaymentResult,
  SubscriptionBuyerInfo,
} from '@modules/platform/subscription/infrastructure/adapters/billing-adapter.interface';
import { TransactionManager } from '@src/infrastructure/persistence/prisma/transaction';
import {
  LogAction,
  LogSource,
  LogType,
} from '@src/domain/constants/log-action.constant';
import { Subscription } from '@modules/platform/subscription/domain/entities/subscription.entity';
import { SubscriptionCharge } from '@modules/platform/subscription/domain/entities/subscription-charge.entity';
import { Money } from '@src/domain/value-objects/money.vo';
import { CurrencyType } from '@input-type-schemas/CurrencySchema';
import { DateTimeManager } from '@common/utils';
import { CriticalFailurePublisher } from '@common/observability/critical-failure.publisher';
import { SavedCardRef } from '@modules/platform/subscription/infrastructure/adapters/billing-adapter.interface';
import {
  ISubscriptionCommandRepository,
  SUBSCRIPTION_COMMAND_REPOSITORY,
} from '@modules/platform/subscription/domain/repositories/subscription/subscription.command.repository';
import {
  ISubscriptionPaymentMethodCommandRepository,
  SUBSCRIPTION_PAYMENT_METHOD_COMMAND_REPOSITORY,
} from '@modules/platform/subscription/domain/repositories/subscription-payment-method/subscription-payment-method.command.repository';
import {
  ISubscriptionChargeCommandRepository,
  SUBSCRIPTION_CHARGE_COMMAND_REPOSITORY,
} from '@modules/platform/subscription/domain/repositories/subscription-charge/subscription-charge.command.repository';

const RENEWAL_LABEL = 'Abonelik yenileme';
const BILLING_PERIOD_MONTHS = 1;

/** Tahsilat çağrısı için gereken, transaction DIŞINA taşınan bağlam. */
interface ClaimedRenewal {
  readonly chargeId: string;
  readonly subscriptionId: string;
  readonly organizationId: string;
  readonly amount: Money;
  readonly periodStart: Date;
  readonly periodEnd: Date;
  readonly savedCard: SavedCardRef;
  readonly buyer: SubscriptionBuyerInfo;
}

/**
 * Kayıtlı karttan abonelik yenileme tahsilatı — **sahiplen → çek → yaz**.
 *
 * Neden üç faz: tahsilat çağrısı geri alınamaz bir yan etkidir. Önceki akış
 * çekimi transaction'ın İÇİNDE, abonelik satırı `FOR UPDATE` kilitliyken
 * yapıyordu. Bu eşzamanlı iki çalıştırmayı engelliyordu ama **sıralı** mükerrer
 * çekimi engellemiyordu: çekim başarılı olup commit başarısız olursa (statement
 * timeout, bağlantı kopması, pod kill, outbox yazım hatası) `currentPeriodEnd`
 * ilerlemiyor ve bir sonraki zamanlanmış çalıştırma kartı **ikinci kez**
 * çekiyordu — üstelik ilk çekimin hiçbir kaydı olmadığı için fark edilmeden.
 *
 * Yeni akış parayı her zaman kaydının **arkasından** getirir:
 *
 * 1. **Sahiplenme** (kendi tx'i, commit edilir): dönem için `PENDING` tahsilat
 *    satırı açılır. `(subscriptionId, periodStart)` tekilliği ikinci bir
 *    çalıştırmanın aynı dönemi çekmesini DB düzeyinde imkânsız kılar.
 * 2. **Tahsilat**: transaction ve kilit **dışında** — yavaş HTTP çağrısı
 *    bağlantıyı ve satırı tutmaz.
 * 3. **Sonuç** (kendi tx'i): satır `SUCCEEDED`/`FAILED` olur, abonelik yenilenir.
 *
 * Faz 3 düşerse satır `PENDING` kalır; bu "başarısız" değil **"çekim yapıldı mı
 * bilinmiyor"** demektir → sonraki çalıştırma **çekim yapmaz**, alarm üretir.
 * Faz 3'ten önce çekim başarılı olup satır yazılabildiyse ama abonelik
 * güncellenemediyse, sonraki çalıştırma bunu `SUCCEEDED` satırdan görüp dönemi
 * **para çekmeden** ilerletir (kendini onarır).
 */
@CommandHandler(ProcessSubscriptionRenewalsCommand)
export class ProcessSubscriptionRenewalsHandler implements ICommandHandler<
  ProcessSubscriptionRenewalsCommand,
  void
> {
  private readonly logger = new Logger(ProcessSubscriptionRenewalsHandler.name);

  constructor(
    @Inject(SUBSCRIPTION_COMMAND_REPOSITORY)
    private readonly subscriptionRepo: ISubscriptionCommandRepository,
    @Inject(SUBSCRIPTION_PAYMENT_METHOD_COMMAND_REPOSITORY)
    private readonly paymentMethodRepo: ISubscriptionPaymentMethodCommandRepository,
    @Inject(SUBSCRIPTION_CHARGE_COMMAND_REPOSITORY)
    private readonly chargeRepo: ISubscriptionChargeCommandRepository,
    @Inject(BILLING_ADAPTER)
    private readonly billingAdapter: IBillingAdapter,
    private readonly criticalFailure: CriticalFailurePublisher,
    private readonly txManager: TransactionManager
  ) {}

  async execute(): Promise<void> {
    const due = await this.subscriptionRepo.findDueForRenewal(
      DateTimeManager.create()
    );
    if (due.length === 0) return;

    this.logger.log(`Yenileme: ${due.length} dönem-sonu abonelik işleniyor`);

    for (const candidate of due) {
      // Her abonelik ayrı işlenir — biri hata verirse diğerleri etkilenmez.
      await this.renewOne(candidate.id.value).catch((err) =>
        this.logger.error(
          `Yenileme hatası (subscriptionId: ${candidate.id.value})`,
          err
        )
      );
    }
  }

  private async renewOne(subscriptionId: string): Promise<void> {
    const claimed = await this.txManager.outboxRun(() =>
      this.claimPeriod(subscriptionId)
    );
    if (!claimed) return;

    // Faz 2 — dış çağrı: transaction kapandı, satır kilidi bırakıldı.
    const result = await this.billingAdapter.chargeSavedCard({
      organizationId: claimed.organizationId,
      amount: claimed.amount,
      label: RENEWAL_LABEL,
      savedCard: claimed.savedCard,
      buyer: claimed.buyer,
    });

    await this.txManager.outboxRun(() => this.recordResult(claimed, result));
  }

  /** Faz 1 — dönemi sahiplen. `null` → bu çalıştırma tahsilat YAPMAZ. */
  private async claimPeriod(
    subscriptionId: string
  ): Promise<ClaimedRenewal | null> {
    const subscription =
      await this.subscriptionRepo.findByIdForUpdate(subscriptionId);
    if (!subscription) return null;

    if (!subscription.isDueForRenewal(DateTimeManager.create())) {
      this.logger.verbose(
        `Yenileme atlandı, abonelik artık dönem-sonu değil: ${subscriptionId}`
      );
      return null;
    }

    if (subscription.cancelAtPeriodEnd) {
      subscription.cancel();
      await this.subscriptionRepo.update(subscription);
      return null;
    }

    // Çekilecek tutar ve kullanılacak kart doğrudan para hareketini belirliyor →
    // ikisi de command repo'dan (ana bağlantı, aynı transaction).
    const [savedCard, charge] = await Promise.all([
      this.paymentMethodRepo.findBySubscriptionId(subscriptionId),
      this.subscriptionRepo.findRenewalCharge(subscriptionId),
    ]);

    // Kayıtlı kart veya tahsil edilecek tutar yoksa otomatik çekim yapılamaz → PAST_DUE.
    if (!savedCard || !charge) {
      this.failRenewal(subscription);
      await this.subscriptionRepo.update(subscription);
      return null;
    }

    const amount = Money.fromTrusted(
      charge.amount,
      charge.currency as CurrencyType
    );
    const periodStart =
      subscription.currentPeriodEnd ?? DateTimeManager.create();
    const periodEnd = DateTimeManager.addMonths(
      periodStart,
      BILLING_PERIOD_MONTHS
    );

    const context = (chargeId: string): ClaimedRenewal => ({
      chargeId,
      subscriptionId,
      organizationId: subscription.organizationId.value,
      amount,
      periodStart,
      periodEnd,
      savedCard: {
        cardUserKey: savedCard.cardUserKey,
        cardToken: savedCard.cardToken,
      },
      buyer: {
        id: subscription.organizationId.value,
        name: savedCard.buyer.name,
        surname: savedCard.buyer.surname,
        email: savedCard.buyer.email,
        gsmNumber: savedCard.buyer.gsmNumber,
        ip: savedCard.buyer.ip,
        city: savedCard.buyer.city ?? undefined,
        address: savedCard.buyer.address ?? undefined,
      },
    });

    const claimed = await this.chargeRepo.claim(
      SubscriptionCharge.claim({
        subscriptionId,
        organizationId: subscription.organizationId.value,
        periodStart,
        periodEnd,
        amount: amount.value,
        currency: amount.currency,
      })
    );
    if (claimed) return context(claimed.id.value);

    // Tekillik tuttu: bu dönem için satır zaten var. Durumuna göre karar verilir.
    return this.resolveExistingCharge({
      subscription,
      periodStart,
      periodEnd,
      amount,
      context,
    });
  }

  /**
   * Dönemin tahsilat satırı zaten varsa ne yapılacağını belirler.
   *
   * Üç durum, üç farklı anlam:
   * - `SUCCEEDED`: para çekilmiş ama abonelik ilerlememiş (faz 3 düşmüş) →
   *   dönem **para çekmeden** ilerletilir. Defter satırı kurtarmanın kaynağıdır.
   * - `PENDING`: çekim yapıldı mı **bilinmiyor** → asla yeniden çekilmez, alarm.
   * - `FAILED`: sağlayıcı reddetmiş → aynı satır üzerinde yeniden denenir.
   */
  private async resolveExistingCharge(input: {
    subscription: Subscription;
    periodStart: Date;
    periodEnd: Date;
    amount: Money;
    context: (chargeId: string) => ClaimedRenewal;
  }): Promise<ClaimedRenewal | null> {
    const { subscription, periodStart, periodEnd, amount, context } = input;
    const subscriptionId = subscription.id.value;

    const existing = await this.chargeRepo.findByPeriod(
      subscriptionId,
      periodStart
    );
    if (!existing) return null;

    if (existing.isSucceeded && existing.providerPaymentId) {
      this.logger.warn(
        `Dönem tahsil edilmiş ama abonelik ilerlememiş; para çekilmeden onarılıyor: ${subscriptionId}`
      );
      subscription.renew({
        periodStart,
        periodEnd,
        iyzicoPaymentId: existing.providerPaymentId,
        event: {
          action: LogAction.SUBSCRIPTION_RENEWED,
          type: LogType.INFO,
          source: LogSource.SYSTEM,
        },
      });
      await this.subscriptionRepo.update(subscription);
      return null;
    }

    if (existing.isPending) {
      // Para çekilmiş olabilir: yeniden çekmek mükerrer tahsilat riskidir.
      this.criticalFailure.publish({
        operation: 'subscription.renewal.unresolved-charge',
        severity: 'CRITICAL',
        summary:
          'Abonelik tahsilatı sonuçsuz kalmış (PENDING); çekim yapılıp yapılmadığı bilinmiyor.',
        errorMessage: `chargeId=${existing.id.value}`,
        context: {
          subscriptionId,
          chargeId: existing.id.value,
          periodStart: periodStart.toISOString(),
          amount: existing.amount.value.toString(),
          currency: existing.amount.currency,
        },
        // Abonelik org seviyesinde olabilir (franchise değilse klinik yok).
        clinicId: subscription.clinicId?.value ?? null,
        dedupeKey: `subscription-charge-unresolved:${existing.id.value}`,
      });
      return null;
    }

    // FAILED → yeniden dene (dunning). Tutar yeniden okunur.
    existing.retry(amount);
    await this.chargeRepo.update(existing);
    return context(existing.id.value);
  }

  /** Faz 3 — sonucu yaz. */
  private async recordResult(
    claimed: ClaimedRenewal,
    result: PaymentResult
  ): Promise<void> {
    const charge = await this.chargeRepo.findByIdForUpdate(claimed.chargeId);
    const subscription = await this.subscriptionRepo.findByIdForUpdate(
      claimed.subscriptionId
    );
    if (!charge || !subscription) return;

    // Başka bir çalıştırma sonucu yazmışsa ikinci kez yazılmaz.
    if (!charge.isPending) {
      this.logger.warn(
        `Tahsilat sonucu zaten yazılmış, atlanıyor: chargeId=${claimed.chargeId}`
      );
      return;
    }

    if (result.success && result.iyzicoPaymentId) {
      charge.markSucceeded(result.iyzicoPaymentId, result.paidAmount);
      await this.chargeRepo.update(charge);

      if (charge.hasAmountMismatch()) {
        // Sağlayıcının çektiği tutar bizim beyanımızdan farklı: bastırılmaz.
        this.criticalFailure.publish({
          operation: 'subscription.renewal.amount-mismatch',
          severity: 'CRITICAL',
          summary:
            'Sağlayıcının tahsil ettiği tutar abonelik tutarından farklı.',
          errorMessage: null,
          context: {
            subscriptionId: claimed.subscriptionId,
            chargeId: charge.id.value,
            expected: charge.amount.value.toString(),
            paid: charge.paidAmount?.value.toString() ?? null,
            currency: charge.amount.currency,
          },
          clinicId: subscription.clinicId?.value ?? null,
          dedupeKey: `subscription-charge-mismatch:${charge.id.value}`,
        });
      }

      subscription.renew({
        periodStart: claimed.periodStart,
        periodEnd: claimed.periodEnd,
        iyzicoPaymentId: result.iyzicoPaymentId,
        event: {
          action: LogAction.SUBSCRIPTION_RENEWED,
          type: LogType.INFO,
          source: LogSource.SYSTEM,
        },
      });
    } else {
      charge.markFailed(result.errorMessage);
      await this.chargeRepo.update(charge);
      this.failRenewal(subscription, result.errorMessage);
    }

    await this.subscriptionRepo.update(subscription);
  }

  private failRenewal(subscription: Subscription, errorMessage?: string): void {
    subscription.failPayment({
      action: LogAction.SUBSCRIPTION_PAYMENT_FAILED,
      type: LogType.WARNING,
      source: LogSource.SYSTEM,
      errorMessage,
    });
  }
}
