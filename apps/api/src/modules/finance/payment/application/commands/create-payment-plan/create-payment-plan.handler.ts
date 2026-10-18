import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { CreatePaymentPlanCommand } from './create-payment-plan.command';
import { CreatePaymentPlanCommandResponse } from './create-payment-plan.response';

import { Inject } from '@nestjs/common';
import { Payment } from '@modules/finance/payment/domain/entities/payment.entity';
import { Money } from '@src/domain/value-objects/money.vo';
import { UUID } from '@src/domain/value-objects/uuid.vo';
import {
  IPaymentCommandRepository,
  PAYMENT_COMMAND_REPOSITORY,
} from '@modules/finance/payment/domain/repositories/payment/payment.command.repository';

@CommandHandler(CreatePaymentPlanCommand)
export class CreatePaymentPlanHandler implements ICommandHandler<
  CreatePaymentPlanCommand,
  CreatePaymentPlanCommandResponse
> {
  constructor(
    @Inject(PAYMENT_COMMAND_REPOSITORY)
    private readonly paymentRepo: IPaymentCommandRepository
  ) {}

  async execute(
    command: CreatePaymentPlanCommand
  ): Promise<CreatePaymentPlanCommandResponse> {
    const { data } = command;

    const installmentsData = data.installments.map((inst, idx) => ({
      id: UUID.generate().value,
      installmentNo: idx + 1,
      money: Money.create(inst.amount, data.currency).orThrow(),
      method: inst.method,
      dueDate: inst.dueDate,
      note: inst.note,
    }));

    const calculatedTotalMoney = installmentsData
      .map((inst) => inst.money)
      .reduce((total, current) => total.add(current));

    calculatedTotalMoney.validate.greaterThanZero.orThrow(
      'Ödeme planı toplam tutarı sıfırdan büyük olmalıdır.'
    );

    const payment = Payment.create({
      totalAmount: calculatedTotalMoney,
      clinicId: data.clinicId,
      patientId: data.patientId,
      appointmentId: data.appointmentId,
      providerId: data.providerId,
      installments: installmentsData,
    });

    const savedPayment = await this.paymentRepo.create(payment);
    // `id` bir VO; dışarıya ham değer döner (create komutları string id döndürür).
    return savedPayment.id.value;
  }
}
