import { Injectable, Logger } from '@nestjs/common';
import { PAYMENT_EVENTS } from '@src/domain/constants/events';
import { PaymentChargedBackEvent } from '@modules/finance/payment/domain/events/payment-charged-back.event';
import { FinanceLedgerProducer } from '@modules/finance/finance-ledger/infrastructure/messaging/queue/producers/finance-ledger.producer';
import { CriticalFailurePublisher } from '@common/observability/critical-failure.publisher';
import { OnDomainEvent } from '@common/decorators';

/**
 * Ters ibraz (kaybedilen kart itirazı) olayını cari defter kuyruğuna taşır.
 *
 * İade dinleyicisi (`PaymentRefundedListener`) ile aynı mantık: iş yalnız
 * kimlikleri taşır, komut yazarken kaynağın nihai durumunu okur — yani sıra
 * önemsizdir. Cari kayıt `COMPLETED` → `CHARGED_BACK` olur ve gelirden düşer.
 * Telafi taksidi (`PENDING`) için kayıt YAZILMAZ: parası hareket etmemiş taksidin
 * defterde karşılığı olmamalıdır; hasta öderse kendi kaydı tahsilat olarak doğar.
 */
@Injectable()
export class PaymentChargedBackListener {
  private readonly logger = new Logger(PaymentChargedBackListener.name);

  constructor(
    private readonly financeLedgerProducer: FinanceLedgerProducer,
    private readonly criticalFailure: CriticalFailurePublisher
  ) {}

  @OnDomainEvent(PAYMENT_EVENTS.CHARGED_BACK)
  async handlePaymentChargedBack(
    event: PaymentChargedBackEvent
  ): Promise<void> {
    this.logger.log(
      `Ters ibraz eventi yakalandı: taksit=${event.installmentId}`
    );

    try {
      await this.financeLedgerProducer.addToLedgerQueue({
        installmentId: event.installmentId,
        paymentId: event.paymentId,
        clinicId: event.clinicId,
        reason: 'CHARGED_BACK',
        actorId: event.log?.actorId ?? null,
      });
    } catch (error) {
      this.logger.error(
        `Cari ters ibraz işi kuyruğa alınamadı: taksit=${event.installmentId}`,
        error
      );
      // Para sağlayıcı tarafından geri alındı ama cari kayıt hâlâ tahsilat
      // görünüyor: gelir olduğundan fazla raporlanır.
      this.criticalFailure.publish({
        operation: 'finance.ledger.charge-back',
        severity: 'CRITICAL',
        summary:
          'Kart itirazı kaybedildi ancak cari kayıt ters ibraz olarak işaretlenemedi.',
        errorMessage: error instanceof Error ? error.message : String(error),
        context: {
          installmentId: event.installmentId,
          paymentId: event.paymentId,
        },
        clinicId: event.clinicId,
        dedupeKey: `ledger-charge-back-failed:${event.installmentId}`,
      });
    }
  }
}
