import { TSCommandBus } from '@common/cqrs/type-safe-command-bus';
import { TSQueryBus } from '@common/cqrs/type-safe-query-bus';
import InstallmentStatusSchema from '@input-type-schemas/InstallmentStatusSchema';
import { MarkInstallmentAsRefundedCommand } from '@modules/finance/payment/application/commands/mark-installment-as-refunded/mark-installment-as-refunded.command';
import { GetPaymentWithInstallmentsQuery } from '@modules/finance/payment/application/queries/get-payment-with-installments/get-payment-with-installments.query';
import { IyzicoResultGuard } from '@src/domain/value-objects/iyzico-result-guard.vo';
import {
  IIyzicoTransactionCommandRepository,
  IYZICO_TRANSACTION_COMMAND_REPOSITORY,
} from '@modules/finance/pos/virtual/domain/repositories/iyzico-transaction.repository.interface';
import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import {
  CompletedInstallmentNotFoundException,
  PaymentNotFoundException,
} from '@modules/finance/payment/domain/exceptions/payment.exceptions';
import { IyzicoPaymentRecordNotFoundException } from '@modules/finance/pos/virtual/domain/exceptions/iyzico.exceptions';
import {
  IIyzicoProvider,
  IYZICO_PROVIDER,
} from '@src/infrastructure/payment/pos/virtual/providers/iyzico/interfaces/iyzico.provider.interface';
import { TransactionManager } from '@src/infrastructure/persistence/prisma/transaction';
import { RefundPaymentCommand } from './refund-payment.command';
import { RefundPaymentCommandResponse } from './refund-payment.response';
import { Currency, UUID } from '@src/domain/value-objects';
import { ExecutionContextFactory } from '@src/domain/common/execution/execution-context.factory';
import {
  IPolicyFactory,
  POLICY_FACTORY,
} from '@modules/platform/policy/staff/domain/interfaces/policy-factory.interface';
import { EnsurePartyForPatientCommand } from '@modules/finance/party/application/commands/ensure-party-for-patient/ensure-party-for-patient.command';
import { RecordFinancialEventCommand } from '@modules/finance/accounting/financial-events/application/commands/record-financial-event/record-financial-event.command';
import { FinancialEventTypeSchema, PartyRoleSchema } from '@shared';
import { FINANCIAL_EVENT_SOURCE_MODULES } from '@modules/finance/shared/domain/constants/financial-event-source-modules.constant';
import { FinancialEventDedupeKeys } from '@modules/finance/shared/domain/constants/financial-event-dedupe-keys.constant';

@CommandHandler(RefundPaymentCommand)
export class RefundPaymentHandler implements ICommandHandler<
  RefundPaymentCommand,
  RefundPaymentCommandResponse
> {
  constructor(
    @Inject(IYZICO_PROVIDER)
    private readonly iyzicoProvider: IIyzicoProvider,
    @Inject(IYZICO_TRANSACTION_COMMAND_REPOSITORY)
    private readonly iyzicoCommandRepo: IIyzicoTransactionCommandRepository,
    private readonly txManager: TransactionManager,
    private readonly commandBus: TSCommandBus,
    private readonly queryBus: TSQueryBus,
    @Inject(POLICY_FACTORY)
    private readonly policyFactory: IPolicyFactory
  ) {}

  async execute(
    command: RefundPaymentCommand
  ): Promise<RefundPaymentCommandResponse> {
    const { paymentId, ip } = command;

    const ctx = ExecutionContextFactory.createInternal();

    const { data: payment } = await this.queryBus.execute(
      new GetPaymentWithInstallmentsQuery(paymentId)
    );
    if (!payment) throw new PaymentNotFoundException(paymentId);

    // `paymentId` istekten geliyor; kapsam kaydın KENDİ kliniğinden doğrulanır.
    // Kontrol dış SDK çağrısından ÖNCE — sonra olsaydı para çoktan hareket etmişti.
    this.policyFactory
      .finance(command.ctx.actor, command.ctx.source)
      .evaluator.check((p) => p.canAccessClinicFinances(payment.clinicId))
      .orThrow('payment.iyzico.refund');

    const completedInstallment = payment.installments.find(
      (i) => i.status === InstallmentStatusSchema.enum.COMPLETED
    );

    if (!completedInstallment)
      throw new CompletedInstallmentNotFoundException();

    // İade çağrısı için dış referans (paymentTransactionId). Okuma command repo'dan:
    // kayıt az önce yazılmış olabilir, replica gecikmesi iadeyi "kayıt yok" diye
    // reddederdi. Kilit burada anlamsız — SDK çağrısı transaction dışında olmalı.
    const iyzicoTx = await this.iyzicoCommandRepo.findByInstallmentId(
      completedInstallment.id
    );

    if (!iyzicoTx?.iyzicoPaymentTransactionId) {
      throw new IyzicoPaymentRecordNotFoundException(
        'Bu ödeme için iyzico işlem transaction kaydı bulunamadı.'
      );
    }

    const generatedConversationUUID = UUID.generate();

    const sdkResult = await this.iyzicoProvider.refund({
      locale: 'TR',
      conversationId: generatedConversationUUID.value,
      paymentTransactionId: iyzicoTx.iyzicoPaymentTransactionId,
      price: completedInstallment.amount.toString(),
      ip,
      currency: Currency.enum.TRY,
    });

    IyzicoResultGuard.create({
      status: sdkResult.status,
      errorMessage: sdkResult.errorMessage,
    })
      .isSuccess()
      .orThrow();

    await this.txManager.outboxRun(async () => {
      // SDK çağrısı sürerken callback/webhook aynı kaydı güncellemiş olabilir;
      // yukarıdaki kopyayı geri yazmak onu ezerdi. Kilitli ve taze okunur.
      const lockedTx =
        await this.iyzicoCommandRepo.findByInstallmentIdForUpdate(
          completedInstallment.id
        );
      if (!lockedTx) {
        throw new IyzicoPaymentRecordNotFoundException(
          'Bu ödeme için iyzico işlem transaction kaydı bulunamadı.'
        );
      }

      lockedTx.markAsRefunded({ rawResponse: sdkResult });
      await this.iyzicoCommandRepo.update(lockedTx);

      await this.commandBus.execute(
        new MarkInstallmentAsRefundedCommand({
          installmentId: completedInstallment.id,
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
      // Bu satır eklenene kadar iade yevmiyeye hiç ulaşmıyordu: 108'de hiç
      // gelmeyecek para, 120'de kapanmış görünen bir borç kalıyordu.
      await this.recordPaymentRefunded({
        patientId: payment.patientId,
        clinicId: payment.clinicId,
        installmentId: completedInstallment.id,
        paymentId,
        amount: completedInstallment.amount.toString(),
      });
    });
  }

  /**
   * İadeyi çift taraflı deftere köprüler: hastanın carisini garanti eder ve
   * `PAYMENT_REFUNDED` ekonomik olayını yazar (120 / 108).
   *
   * Hata YUTULMAZ — tahsilat köprüsüyle (bkz. `handle-payment-callback`) aynı
   * tercih: aynı `outboxRun` içindeyiz, köprü patlarsa iade işaretlemesi de geri
   * sarılır ve yerel durum ile defter **birlikte** eski hâlinde kalır. Yarısını
   * yazıp diğerini alarmla bırakmak, iade edilmiş bir taksitin defterde hâlâ
   * tahsilat görünmesi demekti — bu turun kapattığı hatanın aynısı.
   */
  private async recordPaymentRefunded(
    input: RecordPaymentRefundedInput
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
            // Sanal POS iadesi her zaman karttan geri gider → 108.
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

interface RecordPaymentRefundedInput {
  patientId: string;
  clinicId: string;
  installmentId: string;
  paymentId: string;
  amount: string;
}
