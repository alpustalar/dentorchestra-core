import {
  BILLING_ADAPTER,
  CapturedSavedCard,
  IBillingAdapter,
} from '@modules/platform/subscription/infrastructure/adapters/billing-adapter.interface';
import { Inject, Logger, NotFoundException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import {
  LogAction,
  LogSource,
  LogType,
} from '@src/domain/constants/log-action.constant';
import { TransactionManager } from '@src/infrastructure/persistence/prisma/transaction';
import { DateTimeManager } from '@common/utils';
import { Subscription } from '@modules/platform/subscription/domain/entities/subscription.entity';
import { HandleSubscriptionCallbackCommand } from './handle-subscription-callback.command';
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
import { SubscriptionCharge } from '@modules/platform/subscription/domain/entities/subscription-charge.entity';
import { CurrencyType } from '@input-type-schemas/CurrencySchema';
import { checkIyzicoCallbackBinding } from '@src/infrastructure/payment/pos/virtual/providers/iyzico/rules/iyzico-callback-binding.rule';
import { IyzicoCallbackRejectedException } from '@src/infrastructure/payment/pos/virtual/providers/iyzico/rules/iyzico-callback-rejected.exception';
import { CriticalFailurePublisher } from '@common/observability/critical-failure.publisher';

const BILLING_PERIOD_MONTHS = 1;

@CommandHandler(HandleSubscriptionCallbackCommand)
export class HandleSubscriptionCallbackHandler implements ICommandHandler<
  HandleSubscriptionCallbackCommand,
  void
> {
  private readonly logger = new Logger(HandleSubscriptionCallbackHandler.name);

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

  async execute(command: HandleSubscriptionCallbackCommand): Promise<void> {
    const { token, conversationId } = command;

    // Ödeme sonucu önce sorulur; aboneliğin okunması transaction'a ertelenir.
    // Böylece hem kilit dış HTTP çağrısı boyunca tutulmaz, hem de yazılan kopya
    // adaptör çağrısı öncesine ait bayat bir kopya olmaz (`update()` tüm alanları yazar).
    const result = await this.billingAdapter.handlePaymentResult(token);

    // Bildirim ↔ abonelik bağı. Uç `@Public`: sonuç `token` ile sağlayıcıdan
    // okunuyor ama güncellenecek abonelik **gövdedeki** `conversationId`'den
    // bulunuyordu. Bağlanmadığı için başka bir ödemenin (hatta başka bir
    // akışın — aynı sağlayıcı hesabı) geçerli token'ı, ödenmemiş bir aboneliği
    // aktive etmeye yetiyordu. Kontrol üç callback'te aynı kuraldan geçer.
    //
    // Abonelikte **yerel token kanıtı yok**: `subscribe-to-plan` yalnız
    // `conversationId`'i (externalId) saklıyor, token'ı saklamıyor → kanıt
    // sağlayıcının yankısıdır. Yankı gelmezse kural fail-closed davranır.
    const binding = checkIyzicoCallbackBinding({
      claimedConversationId: conversationId,
      token,
      storedToken: null,
      retrievedConversationId: result.conversationId,
    });

    if (!binding.bound) {
      this.criticalFailure.publish({
        operation: 'subscription.iyzico.callback',
        severity: 'CRITICAL',
        summary:
          'Abonelik ödeme bildirimi bu aboneliğe ait olduğu kanıtlanamadı; abonelik aktive edilmedi.',
        errorMessage: binding.reason,
        context: { conversationId, reason: binding.reason },
        clinicId: null,
        dedupeKey: `subscription-callback-unbound:${conversationId}`,
      });
      throw new IyzicoCallbackRejectedException({
        recordId: conversationId,
        flow: 'platform-subscription',
        reason: binding.reason,
      });
    }

    await this.txManager.outboxRun(async () => {
      // Kilitli okuma: iyzico aynı ödeme için callback + webhook gönderiyor.
      // Kilitsizken ikisi de aynı aboneliği okuyup dönemi iki kez başlatabilir,
      // kartı iki kez saklayabilir ve iki aktivasyon event'i üretebilirdi.
      const subscription =
        await this.subscriptionRepo.findByExternalIdForUpdate(conversationId);

      if (!subscription) {
        this.logger.warn(
          `Subscription callback: no subscription found for conversationId=${conversationId}`
        );
        throw new NotFoundException(
          `Subscription not found for conversationId=${conversationId}`
        );
      }

      if (result.success && result.iyzicoPaymentId) {
        // iyzico aynı ödeme için callback + webhook gönderir: ikisi de buraya
        // düşer. Mükerrer bildirim dönemi İKİNCİ KEZ başlatmamalı — ama sessizce
        // atılmamalı da: kayıtlı kart bildirimlerden yalnız birinde gelebiliyor
        // ve o bildirim yutulursa sonraki yenileme kartsız kalır (PAST_DUE).
        const isDuplicate =
          subscription.providerPaymentId === result.iyzicoPaymentId;

        if (isDuplicate) {
          this.logger.log(
            `Subscription callback yinelenmiş, dönem yeniden başlatılmadı: paymentId=${result.iyzicoPaymentId}`
          );
        } else {
          subscription.confirmPayment(result.iyzicoPaymentId, {
            action: LogAction.SUBSCRIPTION_ACTIVATED,
            type: LogType.INFO,
            source: LogSource.SYSTEM,
          });
          // İlk başarılı ödeme fatura dönemini başlatır → yenileme günü bu tarihten hesaplanır.
          this.startInitialPeriod(subscription);
          await this.subscriptionRepo.update(subscription);
          await this.recordInitialCharge({
            subscription,
            conversationId,
            providerPaymentId: result.iyzicoPaymentId,
            paidAmount: result.paidAmount,
          });
        }

        // Kart her iki durumda da kaydedilir: yinelenen bildirim onu İLK kez
        // taşıyan bildirim olabilir (upsert olduğu için tekrar yazmak zararsız).
        if (result.savedCard) {
          await this.persistSavedCard(subscription.id.value, result.savedCard);
        }
      } else {
        subscription.failPayment({
          action: LogAction.SUBSCRIPTION_PAYMENT_FAILED,
          type: LogType.WARNING,
          source: LogSource.SYSTEM,
          errorMessage: result.errorMessage,
        });
        await this.subscriptionRepo.update(subscription);
      }
    });
  }

  /**
   * İlk ödemeyi deftere yazar.
   *
   * Para biz haberdar olmadan önce çekildiği için satır doğrudan `SUCCEEDED`
   * doğar (bkz. `SubscriptionCharge.recordCompleted`). Tutar aboneliğin aktif
   * kalemlerinin toplamıdır — `subscribe-to-plan` sağlayıcıya tam bu tutarı
   * gönderir. Kalemi olmayan abonelik (deneme süresi) tahsilat satırı üretmez.
   */
  private async recordInitialCharge(input: {
    subscription: Subscription;
    conversationId: string;
    providerPaymentId: string;
    paidAmount?: string;
  }): Promise<void> {
    const { subscription, conversationId, providerPaymentId, paidAmount } =
      input;

    const periodStart = subscription.currentPeriodStart;
    const periodEnd = subscription.currentPeriodEnd;
    if (!periodStart || !periodEnd) return;

    const charge = await this.subscriptionRepo.findRenewalCharge(
      subscription.id.value
    );
    if (!charge) return;

    await this.chargeRepo.claim(
      SubscriptionCharge.recordCompleted({
        subscriptionId: subscription.id.value,
        organizationId: subscription.organizationId.value,
        periodStart,
        periodEnd,
        amount: charge.amount,
        currency: charge.currency as CurrencyType,
        conversationId,
        providerPaymentId,
        paidAmount,
      })
    );
  }

  private startInitialPeriod(subscription: Subscription): void {
    const start = DateTimeManager.create();
    const end = DateTimeManager.addMonths(start, BILLING_PERIOD_MONTHS);
    subscription.startNewPeriod(start, end);
  }

  private async persistSavedCard(
    subscriptionId: string,
    savedCard: CapturedSavedCard
  ): Promise<void> {
    await this.paymentMethodRepo.upsertBySubscriptionId({
      subscriptionId,
      cardUserKey: savedCard.cardUserKey,
      cardToken: savedCard.cardToken,
      maskedNumber: savedCard.maskedNumber,
      cardAssociation: savedCard.cardAssociation,
      cardFamily: savedCard.cardFamily,
      buyerName: savedCard.buyer.name,
      buyerSurname: savedCard.buyer.surname,
      buyerEmail: savedCard.buyer.email,
      buyerGsmNumber: savedCard.buyer.gsmNumber,
      buyerIp: savedCard.buyer.ip,
      buyerCity: savedCard.buyer.city,
      buyerAddress: savedCard.buyer.address,
    });
  }
}
