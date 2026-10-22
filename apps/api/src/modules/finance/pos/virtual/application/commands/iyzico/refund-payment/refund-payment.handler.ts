import { TSCommandBus } from '@common/cqrs/type-safe-command-bus';
import { TSQueryBus } from '@common/cqrs/type-safe-query-bus';
import InstallmentStatusSchema from '@input-type-schemas/InstallmentStatusSchema';
import { BeginInstallmentReversalCommand } from '@modules/finance/payment/application/commands/begin-installment-reversal/begin-installment-reversal.command';
import { ReleaseInstallmentReversalCommand } from '@modules/finance/payment/application/commands/release-installment-reversal/release-installment-reversal.command';
import { GetPaymentWithInstallmentsQuery } from '@modules/finance/payment/application/queries/get-payment-with-installments/get-payment-with-installments.query';
import { IyzicoResultGuard } from '@src/domain/value-objects/iyzico-result-guard.vo';
import {
  IIyzicoTransactionCommandRepository,
  IYZICO_TRANSACTION_COMMAND_REPOSITORY,
} from '@modules/finance/pos/virtual/domain/repositories/iyzico-transaction.repository.interface';
import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import CardChargebackSourceSchema from '@input-type-schemas/CardChargebackSourceSchema';
import {
  CARD_CHARGEBACK_EXPOSURE_GUARD,
  ICardChargebackExposureGuard,
} from '@modules/finance/bank/domain/services/card-chargeback-exposure/card-chargeback-exposure.guard.interface';
import { Decimal } from 'decimal.js';
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
import { IyzicoReversalFinalizer } from '@modules/finance/pos/virtual/application/services/iyzico-reversal-finalizer.service';
import { RefundPaymentCommand } from './refund-payment.command';
import { RefundPaymentCommandResponse } from './refund-payment.response';
import { Currency, UUID } from '@src/domain/value-objects';
import { ExecutionContextFactory } from '@src/domain/common/execution/execution-context.factory';
import {
  IPolicyFactory,
  POLICY_FACTORY,
} from '@modules/platform/policy/staff/domain/interfaces/policy-factory.interface';

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
    private readonly finalizer: IyzicoReversalFinalizer,
    private readonly queryBus: TSQueryBus,
    @Inject(POLICY_FACTORY)
    private readonly policyFactory: IPolicyFactory,
    @Inject(CARD_CHARGEBACK_EXPOSURE_GUARD)
    private readonly chargebackExposureGuard: ICardChargebackExposureGuard
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
    // Damgadan ÖNCE okunur: kayıt yoksa damga atılmamış olmalı (geri alınmaz kalırdı).
    const iyzicoTx = await this.iyzicoCommandRepo.findByInstallmentId(
      completedInstallment.id
    );

    if (!iyzicoTx?.iyzicoPaymentTransactionId) {
      throw new IyzicoPaymentRecordNotFoundException(
        'Bu ödeme için iyzico işlem transaction kaydı bulunamadı.'
      );
    }

    // Kart itirazı da aynı taksidin aynı tutarına dokunur: açık ya da kaybedilmiş
    // bir itiraz varken iade/iptal parayı kart sahibine İKİ KEZ götürürdü (bir kez
    // sağlayıcı kesintisi, bir kez bizim iademiz). Kapı SDK çağrısından ÖNCE, ödeme
    // satırı kilitliyken çalışır ve aynı kısa transaction'da taksit "geri götüren
    // girişim sürüyor" diye damgalanır: SDK uçuştayken açılmaya çalışılan itiraz
    // damgayı görür ve reddedilir (kural 18d). Kapı reddederse damga geri sarılır.
    const completedAmount = new Decimal(completedInstallment.amount.toString());
    await this.txManager.run(async () => {
      await this.commandBus.execute(
        new BeginInstallmentReversalCommand(completedInstallment.id, ctx)
      );
      await this.chargebackExposureGuard.assertReversalWithinCollection({
        sourceType: CardChargebackSourceSchema.enum.ONLINE_PAYMENT,
        sourceId: completedInstallment.id,
        collectedAmount: completedAmount,
        // COMPLETED taksit henüz iade edilmemiştir (iade → REFUNDED durumuna geçer).
        alreadyReversedAmount: new Decimal(0),
        requestedAmount: completedAmount,
      });
    });

    const generatedConversationUUID = UUID.generate();

    // SDK FIRLATIRSA (zaman aşımı, bağlantı kopması) sonuç BİLİNMİYOR: iade sağlayıcıda
    // başarılı olmuş olabilir. Damga kasıtlı olarak kalır — itirazı engellemeye devam
    // eder; aynı yolun yeniden denemesi `REVERSAL_RETRY_AFTER_MINUTES` sonra açılır.
    const sdkResult = await this.iyzicoProvider.refund({
      locale: 'TR',
      conversationId: generatedConversationUUID.value,
      paymentTransactionId: iyzicoTx.iyzicoPaymentTransactionId,
      price: completedInstallment.amount.toString(),
      ip,
      currency: Currency.enum.TRY,
    });

    const outcome = IyzicoResultGuard.create({
      status: sdkResult.status,
      errorMessage: sdkResult.errorMessage,
    }).isSuccess();

    if (!outcome.isValid) {
      // Sağlayıcı AÇIKÇA reddetti: para gitmedi, damga kalkar.
      await this.commandBus.execute(
        new ReleaseInstallmentReversalCommand(completedInstallment.id, ctx)
      );
      outcome.orThrow();
    }

    await this.finalizer.finalize({
      installmentId: completedInstallment.id,
      paymentId,
      clinicId: payment.clinicId,
      patientId: payment.patientId,
      amount: completedInstallment.amount.toString(),
      rawResponse: sdkResult,
      ctx,
    });
  }
}
