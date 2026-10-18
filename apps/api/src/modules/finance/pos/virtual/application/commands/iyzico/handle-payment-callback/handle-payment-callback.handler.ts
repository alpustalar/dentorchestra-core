import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { HandlePaymentCallbackCommand } from './handle-payment-callback.command';
import { HandlePaymentCallbackCommandResponse } from './handle-payment-callback.response';
import { TransactionManager } from '@src/infrastructure/persistence/prisma/transaction';
import { Inject, Logger } from '@nestjs/common';
import { IyzicoTransactionNotFoundException } from '@modules/finance/pos/virtual/domain/exceptions/iyzico.exceptions';
import { checkIyzicoCallbackBinding } from '@src/infrastructure/payment/pos/virtual/providers/iyzico/rules/iyzico-callback-binding.rule';
import { IyzicoCallbackRejectedException } from '@src/infrastructure/payment/pos/virtual/providers/iyzico/rules/iyzico-callback-rejected.exception';
import { CriticalFailurePublisher } from '@common/observability/critical-failure.publisher';
import {
  IIyzicoProvider,
  IYZICO_PROVIDER,
} from '@src/infrastructure/payment/pos/virtual/providers/iyzico/interfaces/iyzico.provider.interface';
import { TSCommandBus } from '@common/cqrs/type-safe-command-bus';
import { ExecutionContextFactory } from '@src/domain/common/execution/execution-context.factory';
import { MarkInstallmentAsPaidCommand } from '@modules/finance/payment/application/commands/mark-installment-as-paid/mark-installment-as-paid.command';
import { MarkInstallmentAsFailedCommand } from '@modules/finance/payment/application/commands/mark-installment-as-failed/mark-installment-as-failed.command';
import { EnsurePartyForPatientCommand } from '@modules/finance/party/application/commands/ensure-party-for-patient/ensure-party-for-patient.command';
import { RecordFinancialEventCommand } from '@modules/finance/accounting/financial-events/application/commands/record-financial-event/record-financial-event.command';
import { FinancialEventTypeSchema, PartyRoleSchema } from '@shared';
import {
  IIyzicoTransactionCommandRepository,
  IYZICO_TRANSACTION_COMMAND_REPOSITORY,
} from '@modules/finance/pos/virtual/domain/repositories/iyzico-transaction.repository.interface';
import { IyzicoTransaction } from '@modules/finance/pos/virtual/domain/entities/iyzico-transaction.entity';
import { FinancialEventDedupeKeys } from '@modules/finance/shared/domain/constants/financial-event-dedupe-keys.constant';
import { FINANCIAL_EVENT_SOURCE_MODULES } from '@modules/finance/shared/domain/constants/financial-event-source-modules.constant';

@CommandHandler(HandlePaymentCallbackCommand)
export class HandlePaymentCallbackHandler implements ICommandHandler<
  HandlePaymentCallbackCommand,
  HandlePaymentCallbackCommandResponse
> {
  private readonly logger = new Logger(HandlePaymentCallbackHandler.name);

  constructor(
    @Inject(IYZICO_PROVIDER)
    private readonly iyzicoProvider: IIyzicoProvider,
    @Inject(IYZICO_TRANSACTION_COMMAND_REPOSITORY)
    private readonly iyzicoCommandRepo: IIyzicoTransactionCommandRepository,
    private readonly txManager: TransactionManager,
    private readonly commandBus: TSCommandBus,
    private readonly criticalFailure: CriticalFailurePublisher
  ) {}

  async execute(
    command: HandlePaymentCallbackCommand
  ): Promise<HandlePaymentCallbackCommandResponse> {
    const { conversationId, token } = command;
    const sdkResult = await this.iyzicoProvider.retrieveCheckoutForm(token);

    await this.txManager.outboxRun(async () => {
      // Kilitli okuma: iyzico aynı ödeme için hem tarayıcı callback'ini hem webhook'u
      // gönderir. Kilitsizken ikisi de PENDING görüp aşağıdaki idempotency kontrolünden
      // geçer → taksit iki kez COMPLETED olur ve muhasebeye iki tahsilat düşerdi.
      const iyzicoTx =
        await this.iyzicoCommandRepo.findByConversationIdForUpdate(
          conversationId
        );

      if (!iyzicoTx) {
        throw new IyzicoTransactionNotFoundException(conversationId);
      }

      const transaction = new IyzicoTransaction(iyzicoTx);

      // Token ↔ konuşma bağı. Kontrol bu handler'da **vardı** ama yalnız
      // burada: aynı sağlayıcı hesabından gelen token'ları işleyen diğer iki
      // callback (rezervasyon, abonelik) korumasızdı. Artık üçü de aynı kuralı
      // çağırıyor — gerekçe `checkIyzicoCallbackBinding` içinde.
      // Yerel token'a ek olarak sağlayıcının yankıladığı conversationId de
      // sınanıyor (iki bağımsız kanıt).
      const binding = checkIyzicoCallbackBinding({
        claimedConversationId: conversationId,
        token,
        storedToken: transaction.token,
        retrievedConversationId: sdkResult.conversationId,
      });

      if (!binding.bound) {
        this.alertUnbound(conversationId, binding.reason);
        throw new IyzicoCallbackRejectedException({
          recordId: conversationId,
          flow: 'pos-virtual-installment',
          reason: binding.reason,
        });
      }

      // Idempotency: başarıyla işlenmiş bir işlem callback/webhook yarışında tekrar gelirse yok say.
      if (transaction.validate.status.isSuccess.value) {
        this.logger.warn(
          `Ödeme zaten önceden işlenmiş (Idempotency). conversationId=${conversationId}`
        );
        return;
      }

      const installment = iyzicoTx.installment;
      const payment = installment.payment;

      if (sdkResult.isSuccess) {
        transaction.markAsSuccess({
          iyzicoPaymentId: sdkResult.paymentId,
          iyzicoPaymentTransactionId: sdkResult.paymentTransactionId,
          rawResponse: sdkResult.rawResponse,
        });
        await this.iyzicoCommandRepo.update(transaction);

        // Taksit COMPLETED; PaymentPaidEvent entity içinde (yalnız gerçek
        // geçişte) fırlatılır. Aktör sanal POS callback'i olduğu için iç bağlam.
        await this.commandBus.execute(
          new MarkInstallmentAsPaidCommand({
            installmentId: installment.id,
            details: 'Ödeme Başarılı',
            ctx: ExecutionContextFactory.createInternal(),
          })
        );

        // Muhasebe köprüsü: cari garanti + ekonomik olay (aynı outboxRun → atomik).
        await this.recordPaymentReceived({
          patientId: payment.patientId,
          clinicId: payment.clinicId,
          installmentId: installment.id,
          paymentId: payment.id,
          amount: installment.amount.toFixed(2),
        });
      } else {
        transaction.markAsFailed({
          errorCode: sdkResult.errorCode,
          errorMessage: sdkResult.errorMessage,
          rawResponse: sdkResult.rawResponse,
        });
        await this.iyzicoCommandRepo.update(transaction);

        // Taksit PENDING'e döner; PaymentFailedEvent entity içinde fırlatılır.
        await this.commandBus.execute(
          new MarkInstallmentAsFailedCommand({
            installmentId: installment.id,
            details: sdkResult.errorMessage,
            ctx: ExecutionContextFactory.createInternal(),
          })
        );
      }
    });
  }

  /**
   * Bağı kanıtlanamayan bildirim duyurulur: bu ya bir **saldırı denemesi** ya da
   * sağlayıcının davranış değişikliğidir (yankı alanı gelmiyor) — ikisi de
   * sessiz kalmamalı. İkincisinde her ödeme reddedilir, yani alarm olmazsa
   * tahsilatların durduğu fark edilmez.
   */
  private alertUnbound(conversationId: string, reason: string): void {
    this.criticalFailure.publish({
      operation: 'pos.virtual.iyzico.callback',
      severity: 'CRITICAL',
      summary:
        'iyzico taksit bildirimi bu kayda ait olduğu kanıtlanamadı; ödeme güncellenmedi.',
      errorMessage: reason,
      context: { conversationId, reason },
      clinicId: null,
      dedupeKey: `iyzico-callback-unbound:${conversationId}`,
    });
  }

  /**
   * Tahsilatı muhasebe katmanına köprüler: hastanın carisini garanti eder ve
   * PAYMENT_RECEIVED ekonomik olayını yazar. dedupeKey ile idempotenttir; olay
   * Outbox'a düşer, posting listener'ı fişi (108/120) asenkron üretir.
   *
   * Hata YUTULMAZ: aynı outboxRun içindeyiz — köprü patlarsa tüm transaction
   * (markAsSuccess + taksit dahil) rollback olmalı ki para defterde kaybolmasın.
   * iyzico callback'i 500 döner, retrieveCheckoutForm + dedupeKey idempotent
   * olduğundan webhook retry temiz şekilde yeniden işler.
   */
  private async recordPaymentReceived(
    input: RecordPaymentReceivedInput
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
          type: FinancialEventTypeSchema.enum.PAYMENT_RECEIVED,
          payload: {
            // Sanal POS tahsilatı her zaman kart → 108 Diğer Hazır Değerler.
            // (Komisyon/valör ayrıştırması banka settlement fazında yapılır.)
            method: 'POS_CARD',
            amount: input.amount,
            partyId,
          },
          sourceModule: FINANCIAL_EVENT_SOURCE_MODULES.PAYMENT,
          sourceRefId: input.paymentId,
          dedupeKey: FinancialEventDedupeKeys.payment_received(
            input.installmentId
          ),
        },
        ctx
      )
    );
  }
}

interface RecordPaymentReceivedInput {
  patientId: string;
  clinicId: string;
  installmentId: string;
  paymentId: string;
  amount: string;
}
