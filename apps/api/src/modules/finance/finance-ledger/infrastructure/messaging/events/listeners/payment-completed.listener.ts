import { Injectable, Logger } from '@nestjs/common';
import { PAYMENT_EVENTS } from '@src/domain/constants/events';
import { PaymentPaidEvent } from '@modules/finance/payment/domain/events/payment-paid.event';
import { FinanceLedgerProducer } from '@modules/finance/finance-ledger/infrastructure/messaging/queue/producers/finance-ledger.producer';
import { CriticalFailurePublisher } from '@common/observability/critical-failure.publisher';
import { OnDomainEvent } from '@common/decorators';

/**
 * Tahsilat olayını cari defter kuyruğuna taşır.
 *
 * Dinleyici **hiçbir tabloyu okumaz**: eskiden `paymentInstallment` ve `clinic`
 * tablolarını doğrudan Prisma ile okuyordu (bounded context ihlali) ve "klinik
 * bulunamadı" halinde kaydı sessizce atlıyordu — tahsilat defterde hiç
 * görünmeden kayboluyordu. Kaydın içeriği artık yazma anında, kaynağın kendi
 * modülünden okunur.
 */
@Injectable()
export class PaymentCompletedListener {
  private readonly logger = new Logger(PaymentCompletedListener.name);

  constructor(
    private readonly financeLedgerProducer: FinanceLedgerProducer,
    private readonly criticalFailure: CriticalFailurePublisher
  ) {}

  @OnDomainEvent(PAYMENT_EVENTS.PAID)
  async handlePaymentPaid(event: PaymentPaidEvent): Promise<void> {
    this.logger.log(
      `Ödeme eventi yakalandı: installmentId=${event.installmentId}`
    );

    try {
      await this.financeLedgerProducer.addToLedgerQueue({
        installmentId: event.installmentId,
        paymentId: event.paymentId,
        clinicId: event.clinicId,
        reason: 'PAID',
        actorId: event.log?.actorId ?? null,
      });

      this.logger.log(
        `Ledger kuyruğuna eklendi: installmentId=${event.installmentId}`
      );
    } catch (error) {
      this.logger.error(
        `Kuyruğa iş eklenirken hata oluştu: installmentId=${event.installmentId}`,
        error
      );
      // Tahsilat alındı ama cari kayıt kuyruğa hiç girmedi: hasta bakiyesi ve
      // klinik geliri eksik görünür, kuyrukta yeniden denenecek bir iş de yok.
      // Telafi yolu: `FindLedgerMismatchesQuery` + `BackfillLedgerEntriesCommand`.
      this.criticalFailure.publish({
        operation: 'finance.ledger.enqueue',
        severity: 'CRITICAL',
        summary: 'Tahsilat için cari kayıt kuyruğa alınamadı.',
        errorMessage: error instanceof Error ? error.message : String(error),
        context: {
          installmentId: event.installmentId,
          paymentId: event.paymentId,
        },
        clinicId: event.clinicId,
        dedupeKey: `ledger-enqueue-failed:${event.installmentId}`,
      });
    }
  }
}
