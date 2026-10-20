import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject, Logger } from '@nestjs/common';
import { Decimal } from 'decimal.js';
import InstallmentStatusSchema from '@input-type-schemas/InstallmentStatusSchema';
import { PaymentInstallment } from '@shared/generated-zod/modelSchema/PaymentInstallmentSchema';
import { ChargeBackInstallmentCommand } from './charge-back-installment.command';
import { ChargeBackInstallmentResponse } from './charge-back-installment.response';
import {
  IPaymentCommandRepository,
  PAYMENT_COMMAND_REPOSITORY,
} from '@modules/finance/payment/domain/repositories/payment/payment.command.repository';
import {
  InstallmentNotFoundException,
  PaymentNotFoundException,
} from '@modules/finance/payment/domain/exceptions/payment.exceptions';
import { TransactionManager } from '@src/infrastructure/persistence/prisma/transaction';
import { UUID } from '@src/domain/value-objects/uuid.vo';

const amountsEqual = (
  installment: PaymentInstallment,
  amount: Decimal
): boolean => new Decimal(installment.amount.toString()).equals(amount);

/**
 * Kaybedilen kart itirazını ödeme planına yansıtır.
 *
 * Kritik finansal işlem → `outboxRun()`: taksit durumu, telafi taksidi ve
 * `PaymentChargedBackEvent` (cari defter senkronu + denetim) **atomik** mühürlenir.
 *
 * Kilit: ödeme satırı `FOR UPDATE` — tahsilat/iade/başarısız geçişleri aynı satırı
 * kilitler, yani itirazın kaybedilmesi bir eşzamanlı callback ile yarışmaz.
 */
@CommandHandler(ChargeBackInstallmentCommand)
export class ChargeBackInstallmentHandler implements ICommandHandler<
  ChargeBackInstallmentCommand,
  ChargeBackInstallmentResponse
> {
  private readonly logger = new Logger(ChargeBackInstallmentHandler.name);

  constructor(
    @Inject(PAYMENT_COMMAND_REPOSITORY)
    private readonly paymentRepo: IPaymentCommandRepository,
    private readonly txManager: TransactionManager
  ) {}

  async execute(
    command: ChargeBackInstallmentCommand
  ): Promise<ChargeBackInstallmentResponse> {
    const {
      paymentId,
      installmentId,
      clinicId,
      amount,
      caseReference,
      dueDate,
      ctx,
    } = command.payload;

    return this.txManager.outboxRun(
      async (): Promise<ChargeBackInstallmentResponse> => {
        const payment = await this.paymentRepo.findByIdForUpdate(paymentId);

        if (!payment) {
          // Taksit biliniyorsa plan MUTLAKA vardır (FK): yokluğu bozuk veridir.
          // Bilinmiyorsa (fiziksel POS) satırın `paymentId`'si boşa düşmüş
          // olabilir — yansıtılacak plan yoktur, para POS kaydında duruyor.
          if (installmentId) throw new PaymentNotFoundException(paymentId);

          this.logger.warn(
            `Ters ibraz için ödeme planı bulunamadı: paymentId=${paymentId}`
          );
          return { outcome: 'NOT_LINKED' };
        }

        // Kiracı bütünlüğü: kayıt başka bir kliniğin planına işaret ediyorsa
        // (bozuk veri ya da yanlış bağ) plana dokunulmaz; varlığı da sızdırılmaz.
        if (payment.clinicId.value !== clinicId) {
          throw new PaymentNotFoundException(paymentId);
        }

        const target = installmentId
          ? payment.installments.find((i) => i.id === installmentId)
          : payment.installments.find(
              (i) =>
                i.status === InstallmentStatusSchema.enum.COMPLETED &&
                amountsEqual(i, amount)
            );

        if (!target) {
          if (installmentId)
            throw new InstallmentNotFoundException(installmentId);
          return { outcome: 'NO_MATCHING_INSTALLMENT' };
        }

        // Kısmi itiraz taksit granülerliğine sığmaz (taksit bölünmez): yanlış
        // taksidi kapatmaktansa plana dokunulmaz. Zaten CHARGED_BACK olan taksit
        // (yeniden işleme) bu kontrolün dışındadır — entity idempotent döner.
        if (
          target.status !== InstallmentStatusSchema.enum.CHARGED_BACK &&
          !amountsEqual(target, amount)
        ) {
          return { outcome: 'NO_MATCHING_INSTALLMENT' };
        }

        const recoveryInstallmentId = payment.chargeBackInstallment({
          installmentId: target.id,
          actorId: ctx.actor.userId,
          logSource: ctx.actor.source,
          recoveryInstallmentId: UUID.generate().value,
          recoveryDueDate: dueDate,
          caseReference,
        });

        // PaymentChargedBackEvent entity içinde raise edilir; `update()` flush eder.
        await this.paymentRepo.update(payment);

        return {
          outcome: 'CHARGED_BACK',
          installmentId: target.id,
          recoveryInstallmentId,
        };
      }
    );
  }
}
