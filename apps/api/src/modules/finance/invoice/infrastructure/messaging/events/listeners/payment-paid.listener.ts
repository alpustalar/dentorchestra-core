import { Injectable, Logger } from '@nestjs/common';
import { PAYMENT_EVENTS } from '@src/domain/constants/events';
import { PaymentPaidEvent } from '@modules/finance/payment/domain/events/payment-paid.event';
import { IssueInvoiceCommand } from '@modules/finance/invoice/application/commands/issue-invoice/issue-invoice.command';
import {
  LogAction,
  LogSource,
  LogType,
} from '@src/domain/constants/log-action.constant';
import { TSCommandBus } from '@common/cqrs/type-safe-command-bus';
import { TSQueryBus } from '@common/cqrs/type-safe-query-bus';
import { GetPaymentWithInstallmentsQuery } from '@modules/finance/payment/application/queries/get-payment-with-installments/get-payment-with-installments.query';
import { Money } from '@src/domain/value-objects/money.vo';
import { CriticalFailurePublisher } from '@common/observability/critical-failure.publisher';
import { OnDomainEvent } from '@common/decorators';

@Injectable()
export class PaymentPaidInvoiceListener {
  private readonly logger = new Logger(PaymentPaidInvoiceListener.name);

  constructor(
    private readonly commandBus: TSCommandBus,
    private readonly queryBus: TSQueryBus,
    private readonly criticalFailure: CriticalFailurePublisher
  ) {}

  @OnDomainEvent(PAYMENT_EVENTS.PAID)
  async handle(event: PaymentPaidEvent): Promise<void> {
    try {
      // Cari + tutar payment modülünden çözülür (bounded context — QueryBus).
      const { data: payment } = await this.queryBus.execute(
        new GetPaymentWithInstallmentsQuery(event.paymentId)
      );
      if (!payment) {
        this.logger.warn(
          `Fatura için ödeme bulunamadı: paymentId=${event.paymentId}`
        );
        return;
      }

      // Faturalanan tutar **ödemenin tamamı**, tahsil edilen taksit DEĞİL.
      //
      // Fatura `payment_id` üzerinde tekil: ilk taksitte açılır, sonraki taksitlerde
      // komut idempotent davranıp mevcut faturayı döner. Tutar taksitten alınsaydı
      // 6 taksitli bir tedavide hasılat yalnız 1/6 oranında kaydedilir, kalan beş
      // taksit hiç faturalanmazdı; 120 Alıcılar ise her tahsilatta kapanmaya devam
      // edip ters bakiyeye düşerdi (hasılat + KDV matrahı eksik beyan).
      //
      // Fatura tahakkuku tahsilattan bağımsızdır (doc 03): hizmet bedeli bir kez
      // faturalanır, taksitler yalnız 120'yi kapatır (PAYMENT_RECEIVED). Bu yüzden
      // randevu dinleyicisi de aynı tutarı (ödeme toplamı) kullanır — iki tetikleyici
      // artık olay sırasından bağımsız olarak aynı faturayı üretir.
      await this.commandBus.execute(
        new IssueInvoiceCommand({
          clinicId: event.clinicId,
          patientId: payment.patientId,
          appointmentId: event.appointmentId,
          paymentId: event.paymentId,
          totalAmount: Money.fromTrusted(payment.totalAmount, payment.currency),
          action: LogAction.INVOICE_ISSUED,
          type: LogType.INFO,
          source: LogSource.SYSTEM,
        })
      );
    } catch (error) {
      this.logger.error(
        `Ödeme sonrası fatura kesilemedi: paymentId=${event.paymentId}`,
        error
      );
      // Tahsilat yapıldı ama faturası kesilmedi — yasal belge eksiği.
      this.criticalFailure.publish({
        operation: 'finance.invoice.issue-on-payment-paid',
        severity: 'CRITICAL',
        summary: 'Tahsilat alındı ancak faturası kesilemedi.',
        errorMessage: error instanceof Error ? error.message : String(error),
        context: {
          paymentId: event.paymentId,
          installmentId: event.installmentId,
        },
        clinicId: event.clinicId,
        dedupeKey: `invoice-failed:payment:${event.paymentId}`,
      });
    }
  }
}
