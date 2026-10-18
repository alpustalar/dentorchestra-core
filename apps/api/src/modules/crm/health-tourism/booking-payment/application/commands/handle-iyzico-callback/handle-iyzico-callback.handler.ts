import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject, Logger } from '@nestjs/common';
import { Decimal } from 'decimal.js';
import { UUID } from '@src/domain/value-objects/uuid.vo';
import { TSCommandBus } from '@common/cqrs/type-safe-command-bus';
import { CriticalFailurePublisher } from '@common/observability/critical-failure.publisher';
import {
  IIyzicoProvider,
  IYZICO_PROVIDER,
} from '@src/infrastructure/payment/pos/virtual/providers/iyzico/interfaces/iyzico.provider.interface';
import { checkIyzicoCallbackBinding } from '@src/infrastructure/payment/pos/virtual/providers/iyzico/rules/iyzico-callback-binding.rule';
import { IyzicoCallbackRejectedException } from '@src/infrastructure/payment/pos/virtual/providers/iyzico/rules/iyzico-callback-rejected.exception';
import {
  BOOKING_PAYMENT_COMMAND_REPOSITORY,
  IBookingPaymentCommandRepository,
} from '@modules/crm/health-tourism/booking-payment/domain/repositories/booking-payment/booking-payment.command.repository';
import { BookingPayment } from '@modules/crm/health-tourism/booking-payment/domain/entities/booking-payment.entity';
import { HandleBookingPaymentIyzicoCallbackCommand } from './handle-iyzico-callback.command';
import { ConfirmBookingPaymentCommand } from '../confirm-booking-payment/confirm-booking-payment.command';
import { ExecutionContextFactory } from '@src/domain/common/execution/execution-context.factory';
import { PaymentProviders } from '@common/constants';

/**
 * Sağlık turizmi rezervasyon ödemesinin iyzico callback'i.
 *
 * Uç `@Public`: çağıran iyzico'nun sunucusu olabilir, başka biri de olabilir.
 * Bu yüzden iki şey ayrı ayrı doğrulanır:
 *
 *   1. **Bağ** — bildirimin gerçekten bu kayda ait olduğu
 *      (`checkIyzicoCallbackBinding`; gerekçe orada).
 *   2. **Tutar** — iyzico'nun bildirdiği sepet tutarının, bu kayıt için
 *      istediğimiz tutar olduğu.
 *
 * İkisi geçmeden `ConfirmBookingPaymentCommand` çağrılmaz, çünkü o komut
 * rezervasyonu **tedarikçide açar** (geri alınamaz yan etki).
 */
@CommandHandler(HandleBookingPaymentIyzicoCallbackCommand)
export class HandleBookingPaymentIyzicoCallbackHandler implements ICommandHandler<
  HandleBookingPaymentIyzicoCallbackCommand,
  void
> {
  private readonly logger = new Logger(
    HandleBookingPaymentIyzicoCallbackHandler.name
  );

  constructor(
    private readonly commandBus: TSCommandBus,
    @Inject(IYZICO_PROVIDER)
    private readonly iyzico: IIyzicoProvider,
    @Inject(BOOKING_PAYMENT_COMMAND_REPOSITORY)
    private readonly bookingPaymentRepo: IBookingPaymentCommandRepository,
    private readonly criticalFailure: CriticalFailurePublisher
  ) {}

  async execute(
    command: HandleBookingPaymentIyzicoCallbackCommand
  ): Promise<void> {
    const { token, conversationId } = command;
    const result = await this.iyzico.retrieveCheckoutForm(token);

    if (!result.isSuccess || !result.paymentTransactionId) {
      this.logger.warn(
        `iyzico booking ödemesi başarısız (bp=${conversationId}): ${
          result.errorMessage ?? 'bilinmeyen'
        }`
      );
      return;
    }

    // Biçim kapısı: `conversationId` kimliği doğrulanmamış bir gövdeden geliyor.
    // Doğrudan sorguya vermek, UUID olmayan bir değerde Postgres cast hatasına
    // (500) dönüşür — saldırganın ürettiği gürültü, gerçek bir arızadan
    // ayırt edilemez hâle gelir.
    if (!UUID.create(conversationId).instance) {
      this.alert(conversationId, 'RECORD_NOT_FOUND');
      throw new IyzicoCallbackRejectedException({
        recordId: conversationId,
        flow: 'health-tourism-booking',
        reason: 'RECORD_NOT_FOUND',
      });
    }

    // Kayıt **Command Repo**'dan okunur: buradan çıkan karar bir mutasyonu
    // (ve geri alınamaz bir tedarikçi çağrısını) tetikliyor.
    const bp = await this.bookingPaymentRepo.findById(conversationId);
    if (!bp) {
      // Bildirimin iddia ettiği kayıt yok. Sessiz geçmek, saldırı denemesini de
      // sağlayıcı tarafındaki bir hatayı da görünmez yapar.
      this.alert(conversationId, 'RECORD_NOT_FOUND');
      throw new IyzicoCallbackRejectedException({
        recordId: conversationId,
        flow: 'health-tourism-booking',
        reason: 'RECORD_NOT_FOUND',
      });
    }

    const binding = checkIyzicoCallbackBinding({
      claimedConversationId: conversationId,
      token,
      // Link üretilirken saklanan token → yerel ve kesin kanıt.
      storedToken: bp.iyzicoToken,
      retrievedConversationId: result.conversationId,
    });

    if (!binding.bound) {
      this.alert(conversationId, binding.reason);
      throw new IyzicoCallbackRejectedException({
        recordId: conversationId,
        flow: 'health-tourism-booking',
        reason: binding.reason,
      });
    }

    this.assertChargedAsAsked(bp, result.price, result.currency);

    await this.commandBus.execute(
      new ConfirmBookingPaymentCommand({
        bookingPaymentId: conversationId,
        provider: PaymentProviders.IYZICO,
        providerRef: result.paymentTransactionId,
        ctx: ExecutionContextFactory.createInternal(),
      })
    );
  }

  /**
   * Sağlayıcının bildirdiği **sepet** tutarı (`price`, tahsil edilen `paidPrice`
   * değil — taksitte komisyonla büyür) bu kayıt için istediğimiz tutarla
   * karşılaştırılır.
   *
   * Bağ kontrolünden sonra bu teorik olarak tutmak zorunda; yine de yazılıyor
   * çünkü tutmadığı an **neyin** bozulduğunu söyler: ödeme formu bayat bir
   * tutarla açılmış ya da kayıt link üretildikten sonra değişmiş olur. Tutar
   * doğrulanmazsa defter yerel tutarı yazar ve sistem kendi kendine tutarlı
   * görünür — fark yalnız sağlayıcı ekstresinde ortaya çıkar.
   */
  private assertChargedAsAsked(
    bp: BookingPayment,
    price: string | undefined,
    currency: string | undefined
  ): void {
    const expected = bp.amountChargedBy(PaymentProviders.IYZICO);

    // Alan gelmiyorsa karşılaştırma yapılamaz: reddetmek meşru tahsilatları
    // durdurur (bağ zaten kanıtlandı), sessiz geçmek farkı gizler → uyarı.
    if (!price || !currency) {
      this.logger.warn(
        `iyzico yanıtında sepet tutarı/para birimi yok (bp=${bp.id.value}); tutar doğrulanamadı.`
      );
      return;
    }

    const matches =
      currency === expected.currency &&
      new Decimal(price).equals(expected.value);

    if (!matches) {
      this.criticalFailure.publish({
        operation: 'health-tourism.booking-payment.iyzico-callback',
        severity: 'CRITICAL',
        summary:
          'iyzico sepet tutarı kaydın beklediği tutarla uyuşmuyor; rezervasyon açılmadı.',
        errorMessage: null,
        context: {
          bookingPaymentId: bp.id.value,
          expected: expected.toApiFormat(),
          expectedCurrency: expected.currency,
          reported: price,
          reportedCurrency: currency,
        },
        clinicId: bp.clinicId.value,
        dedupeKey: `booking-callback-amount-mismatch:${bp.id.value}`,
      });

      throw new IyzicoCallbackRejectedException({
        recordId: bp.id.value,
        flow: 'health-tourism-booking',
        reason: 'AMOUNT_MISMATCH',
      });
    }
  }

  private alert(conversationId: string, reason: string): void {
    this.criticalFailure.publish({
      operation: 'health-tourism.booking-payment.iyzico-callback',
      severity: 'CRITICAL',
      summary:
        'iyzico rezervasyon bildirimi bu kayda ait olduğu kanıtlanamadı; rezervasyon açılmadı.',
      errorMessage: reason,
      context: { bookingPaymentId: conversationId, reason },
      clinicId: null,
      dedupeKey: `booking-callback-unbound:${conversationId}`,
    });
  }
}
