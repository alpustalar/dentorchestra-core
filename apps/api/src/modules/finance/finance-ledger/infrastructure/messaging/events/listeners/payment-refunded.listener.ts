import { Injectable, Logger } from '@nestjs/common';
import { PAYMENT_EVENTS } from '@src/domain/constants/events';
import { PaymentRefundedEvent } from '@modules/finance/payment/domain/events/payment-refunded.event';
import { FinanceLedgerProducer } from '@modules/finance/finance-ledger/infrastructure/messaging/queue/producers/finance-ledger.producer';
import { CriticalFailurePublisher } from '@common/observability/critical-failure.publisher';
import { OnDomainEvent } from '@common/decorators';

/**
 * İade olayını cari defter kuyruğuna taşır.
 *
 * İade **doğrudan** `updateMany` ile işaretleniyordu; kayıt henüz yazılmamışsa
 * (tahsilat işi kuyrukta bekliyorsa) 0 satır güncellenip işlem "başarılı"
 * sayılıyor, ardından tahsilat işi kaydı COMPLETED yazıyordu → iade defterde
 * kalıcı olarak kayboluyordu. Artık iki olay da aynı idempotent komutu
 * kuyruğa koyar; komut yazarken kaynağın nihai durumunu okuduğu için sıra
 * önemsizdir.
 */
@Injectable()
export class PaymentRefundedListener {
  private readonly logger = new Logger(PaymentRefundedListener.name);

  constructor(
    private readonly financeLedgerProducer: FinanceLedgerProducer,
    private readonly criticalFailure: CriticalFailurePublisher
  ) {}

  @OnDomainEvent(PAYMENT_EVENTS.REFUNDED)
  async handlePaymentRefunded(event: PaymentRefundedEvent): Promise<void> {
    this.logger.log(`İade eventi yakalandı: taksit=${event.installmentId}`);

    try {
      await this.financeLedgerProducer.addToLedgerQueue({
        installmentId: event.installmentId,
        paymentId: event.paymentId,
        clinicId: event.clinicId,
        reason: 'REFUNDED',
        actorId: event.log?.actorId ?? null,
      });
    } catch (error) {
      this.logger.error(
        `Cari iade işi kuyruğa alınamadı: taksit=${event.installmentId}`,
        error
      );
      // İade fiilen yapıldı (para geri gitti) ama cari kayıt hâlâ tahsilat
      // görünüyor: gelir olduğundan fazla raporlanır.
      this.criticalFailure.publish({
        operation: 'finance.ledger.refund',
        severity: 'CRITICAL',
        summary: 'İade yapıldı ancak cari kayıt iade olarak işaretlenemedi.',
        errorMessage: error instanceof Error ? error.message : String(error),
        context: {
          installmentId: event.installmentId,
          paymentId: event.paymentId,
        },
        clinicId: event.clinicId,
        dedupeKey: `ledger-refund-failed:${event.installmentId}`,
      });
    }
  }
}
