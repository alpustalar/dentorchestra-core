import { Inject, Injectable } from '@nestjs/common';
import { Decimal } from 'decimal.js';
import InstallmentStatusSchema from '@input-type-schemas/InstallmentStatusSchema';
import {
  IPaymentCommandRepository,
  PAYMENT_COMMAND_REPOSITORY,
} from '@modules/finance/payment/domain/repositories/payment/payment.command.repository';
import {
  IPaymentCollectionService,
  LockCollectedAmountParams,
} from '@modules/finance/payment/domain/services/payment-collection/payment-collection.service.interface';
import {
  InstallmentNotFoundException,
  InstallmentNotRefundableException,
} from '@modules/finance/payment/domain/exceptions/payment.exceptions';

@Injectable()
export class PaymentCollectionService implements IPaymentCollectionService {
  constructor(
    @Inject(PAYMENT_COMMAND_REPOSITORY)
    private readonly paymentRepo: IPaymentCommandRepository
  ) {}

  async lockAndGetCollectedAmount(
    params: LockCollectedAmountParams
  ): Promise<Decimal> {
    // Kilit önce (ödeme satırı FOR UPDATE), okuma sonra — aynı metotta. Taksit
    // geçişleri (tahsil/iade/ters ibraz) aynı satırı kilitlediği için sıraya girer.
    const payment = await this.paymentRepo.findByInstallmentIdForUpdate(
      params.installmentId
    );
    if (!payment) {
      throw new InstallmentNotFoundException(params.installmentId);
    }

    const installment = payment.installments.find(
      (i) => i.id === params.installmentId
    );
    if (!installment) {
      throw new InstallmentNotFoundException(params.installmentId);
    }

    // İade edilmiş / ters ibraz edilmiş / hiç tahsil edilmemiş taksidin geri
    // götürülecek parası yoktur.
    if (installment.status !== InstallmentStatusSchema.enum.COMPLETED) {
      throw new InstallmentNotRefundableException({
        installmentId: params.installmentId,
        status: installment.status,
      });
    }

    return new Decimal(installment.amount.toString());
  }
}
