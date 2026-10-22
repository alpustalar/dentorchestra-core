import { Inject, Injectable } from '@nestjs/common';
import { TSCommandBus } from '@common/cqrs/type-safe-command-bus';
import { IGetContext } from '@common/decorators';
import { FinancialEventTypeSchema, PartyRoleSchema } from '@shared';
import { ExecutionContextFactory } from '@src/domain/common/execution/execution-context.factory';
import { TransactionManager } from '@src/infrastructure/persistence/prisma/transaction';
import { MarkInstallmentAsRefundedCommand } from '@modules/finance/payment/application/commands/mark-installment-as-refunded/mark-installment-as-refunded.command';
import { EnsurePartyForPatientCommand } from '@modules/finance/party/application/commands/ensure-party-for-patient/ensure-party-for-patient.command';
import { RecordFinancialEventCommand } from '@modules/finance/accounting/financial-events/application/commands/record-financial-event/record-financial-event.command';
import { FINANCIAL_EVENT_SOURCE_MODULES } from '@modules/finance/shared/domain/constants/financial-event-source-modules.constant';
import { FinancialEventDedupeKeys } from '@modules/finance/shared/domain/constants/financial-event-dedupe-keys.constant';
import { IyzicoPaymentRecordNotFoundException } from '@modules/finance/pos/virtual/domain/exceptions/iyzico.exceptions';
import {
  IIyzicoTransactionCommandRepository,
  IYZICO_TRANSACTION_COMMAND_REPOSITORY,
} from '@modules/finance/pos/virtual/domain/repositories/iyzico-transaction.repository.interface';

export interface FinalizeIyzicoReversalInput {
  readonly installmentId: string;
  readonly paymentId: string;
  readonly clinicId: string;
  readonly patientId: string;
  readonly amount: string;
  /** Sağlayıcının başarılı yanıtı (tanı amacıyla maskelenerek saklanır). */
  readonly rawResponse: unknown;
  /** Audit log detayı; çağıran bağlama göre geçilir (iade / iptal). */
  readonly details?: string;
  readonly ctx: IGetContext;
}

/**
 * Sağlayıcı parayı kart sahibine GERİ GÖTÜRDÜKTEN sonra yerel durumu kapatır.
 *
 * İade (refund) ve iptal (void) sağlayıcıda farklı çağrılardır ama yerelde tek bir
 * ekonomik olaydır: tahsilat ters döner (120 / 108). Kapanış tek yerde durur —
 * iptal, iade ile aynı yolu izlemeseydi taksit COMPLETED kalır, defter tahsilatı
 * göstermeye devam ederdi (bkz. §97: iptal yolu bu yüzden yerelde hiç kapanmıyordu).
 *
 * Hata YUTULMAZ: hepsi aynı `outboxRun` içinde; köprü patlarsa iade işaretlemesi
 * de geri sarılır ve yerel durum ile defter birlikte eski hâlinde kalır.
 */
@Injectable()
export class IyzicoReversalFinalizer {
  constructor(
    @Inject(IYZICO_TRANSACTION_COMMAND_REPOSITORY)
    private readonly iyzicoCommandRepo: IIyzicoTransactionCommandRepository,
    private readonly txManager: TransactionManager,
    private readonly commandBus: TSCommandBus
  ) {}

  async finalize(input: FinalizeIyzicoReversalInput): Promise<void> {
    const ctx = ExecutionContextFactory.createInternal();

    await this.txManager.outboxRun(async () => {
      // SDK çağrısı sürerken callback/webhook aynı kaydı güncellemiş olabilir;
      // çağıranın elindeki kopyayı geri yazmak onu ezerdi. Kilitli ve taze okunur.
      const lockedTx =
        await this.iyzicoCommandRepo.findByInstallmentIdForUpdate(
          input.installmentId
        );
      if (!lockedTx) {
        throw new IyzicoPaymentRecordNotFoundException(
          'Bu ödeme için iyzico işlem transaction kaydı bulunamadı.'
        );
      }

      lockedTx.markAsRefunded({ rawResponse: input.rawResponse });
      await this.iyzicoCommandRepo.update(lockedTx);

      await this.commandBus.execute(
        new MarkInstallmentAsRefundedCommand({
          installmentId: input.installmentId,
          details: input.details,
          ctx,
        })
      );

      // PaymentRefundedEvent burada YAYINLANMAZ: yukarıdaki
      // MarkInstallmentAsRefundedCommand → Payment.refundInstallment() zaten
      // raise ediyor. İkinci kez yayınlamak CARİ defter ters kaydını
      // (RefundLedgerEntriesCommand) iki kez tetikliyordu.
      //
      // Çift taraflı defter ayrı bir yoldur: yukarıdaki olay cari defteri
      // (finance-ledger) düzeltir, yevmiye için ekonomik olay YAZILMALIDIR.
      await this.recordPaymentRefunded(input);
    });
  }

  /**
   * İadeyi çift taraflı deftere köprüler: hastanın carisini garanti eder ve
   * `PAYMENT_REFUNDED` ekonomik olayını yazar (120 / 108).
   */
  private async recordPaymentRefunded(
    input: FinalizeIyzicoReversalInput
  ): Promise<void> {
    const ctx = ExecutionContextFactory.createInternal();

    const { partyId } = await this.commandBus.execute(
      new EnsurePartyForPatientCommand(
        input.patientId,
        input.clinicId,
        PartyRoleSchema.enum.CUSTOMER,
        ctx
      )
    );

    await this.commandBus.execute(
      new RecordFinancialEventCommand(
        {
          clinicId: input.clinicId,
          type: FinancialEventTypeSchema.enum.PAYMENT_REFUNDED,
          payload: {
            // Sanal POS iadesi/iptali her zaman karttan geri gider → 108.
            method: 'POS_CARD',
            amount: input.amount,
            partyId,
            reference: input.installmentId,
          },
          sourceModule: FINANCIAL_EVENT_SOURCE_MODULES.PAYMENT,
          sourceRefId: input.paymentId,
          dedupeKey: FinancialEventDedupeKeys.payment_refunded(
            input.installmentId
          ),
        },
        ctx
      )
    );
  }
}
