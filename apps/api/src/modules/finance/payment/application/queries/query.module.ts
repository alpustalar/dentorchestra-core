import { Module } from '@nestjs/common';
import { GetPaymentWithInstallmentsHandler } from './get-payment-with-installments/get-payment-with-installments.handler';
import { GetPaymentByAppointmentIdHandler } from './get-payment-by-appointment-id/get-payment-by-appointment-id.handler';
import { GetArAgingHandler } from './get-ar-aging/get-ar-aging.handler';
import { GetProviderRevenueHandler } from './get-provider-revenue/get-provider-revenue.handler';
import { FindCollectedPaymentsHandler } from './find-collected-payments/find-collected-payments.handler';
import { FindSettledInstallmentsHandler } from './find-settled-installments/find-settled-installments.handler';
import { GetInstallmentForLedgerHandler } from './get-installment-for-ledger/get-installment-for-ledger.handler';
import { PaymentRepositoriesModule } from '@modules/finance/payment/infrastructure/persistence/prisma/repositories/repositories.module';

const QueryHandlers = [
  GetPaymentWithInstallmentsHandler,
  GetPaymentByAppointmentIdHandler,
  GetArAgingHandler,
  GetProviderRevenueHandler,
  FindCollectedPaymentsHandler,
  FindSettledInstallmentsHandler,
  GetInstallmentForLedgerHandler,
];

@Module({
  imports: [PaymentRepositoriesModule],
  providers: QueryHandlers,
})
export class PaymentQueryModule {}
