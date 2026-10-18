import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import {
  CreatePaymentCommand,
  CreatePaymentCommandResponse,
} from './create-payment.command';
import { Payment } from '@modules/finance/payment/domain/entities/payment.entity';
import { Money, UUID } from '@src/domain/value-objects';
import {
  IPaymentCommandRepository,
  PAYMENT_COMMAND_REPOSITORY,
} from '@modules/finance/payment/domain/repositories/payment/payment.command.repository';
import { TransactionManager } from '@src/infrastructure/persistence/prisma/transaction/transaction.manager';
import {
  CHARGE_TOTALS_SERVICE,
  IChargeTotalsService,
} from '@modules/finance/treatment-charge/domain/services/charge-totals';
import {
  PaymentAmountUnresolvableException,
  PaymentChargeCurrencyMismatchException,
} from '@modules/finance/payment/domain/exceptions/payment.exceptions';

@CommandHandler(CreatePaymentCommand)
export class CreatePaymentHandler implements ICommandHandler<
  CreatePaymentCommand,
  CreatePaymentCommandResponse
> {
  constructor(
    @Inject(PAYMENT_COMMAND_REPOSITORY)
    private readonly paymentRepo: IPaymentCommandRepository,
    @Inject(CHARGE_TOTALS_SERVICE)
    private readonly chargeTotals: IChargeTotalsService,
    private readonly txManager: TransactionManager
  ) {}

  async execute(
    command: CreatePaymentCommand
  ): Promise<CreatePaymentCommandResponse> {
    const { data, internalRelations } = command;
    const paymentId = UUID.createOrGenerate(internalRelations?.paymentId);
    const installmentId = UUID.createOrGenerate(
      internalRelations?.installmentId
    );

    // Tutar okuması ile ödeme yazması **aynı transaction** içinde: tutar işlem
    // satırlarından türüyorsa satırlar kilit altında okunur, aksi halde okuma
    // ile yazma arasında bir satır iptal edilip tahsilat tutarı satırlardan
    // kayabilir. `run` iç içe çağrıda dıştaki tx'i kullanır (POS/iyzico yolları
    // zaten bir tx içinden çağırıyor).
    return this.txManager.run(async () => {
      const totalAmount = await this.resolveAmount(data);

      const payment = Payment.create({
        id: paymentId.value,
        clinicId: data.clinicId,
        patientId: data.patientId,
        appointmentId: data.appointmentId,
        providerId: data.providerId,
        totalAmount: totalAmount,
        installments: [
          {
            id: installmentId.value,
            installmentNo: 1,
            money: totalAmount,
            method: data.method,
            dueDate: data.dueDate,
            note: data.note,
          },
        ],
      });

      const savedPayment = await this.paymentRepo.create(payment);
      return savedPayment.id.value;
    });
  }

  /**
   * Tahsilat tutarını çözer.
   *
   * Tutar açıkça verilmişse o esastır (kapora, kısmi ödeme, tedavi dışı gelir).
   * Verilmemişse randevunun fiyatlı işlem satırlarından türetilir — asıl yol
   * budur: personelin serbestçe tutar yazması yerine, tahsil edilen para
   * yapılan işlerin ve verilen indirimlerin toplamına eşitlenir.
   */
  private async resolveAmount(
    data: CreatePaymentCommand['data']
  ): Promise<Money> {
    if (data.amount !== undefined) {
      return Money.create(data.amount, data.currency).orThrow();
    }

    if (!data.appointmentId) {
      throw new PaymentAmountUnresolvableException();
    }

    const totals = await this.chargeTotals.lockAndGetAppointmentTotals(
      data.appointmentId
    );

    if (!totals) {
      throw new PaymentAmountUnresolvableException(data.appointmentId);
    }

    // Tutar ve para birimi **aynı kaynaktan** gelir. Eskiden tutar satırlardan,
    // para birimi ise istemciden alınıyordu: satırlar EUR iken istemci TRY
    // gönderdiğinde EUR tutar TRY olarak kaydediliyordu (cari defter ve muhasebe
    // bu yanlış birimi devralıyor, fatura ise para birimi uyuşmazlığı hatasıyla
    // hiç kesilemiyordu).
    if (totals.currency !== data.currency) {
      throw new PaymentChargeCurrencyMismatchException({
        chargesCurrency: totals.currency,
        requestedCurrency: data.currency,
      });
    }

    return totals.grandTotal;
  }
}
