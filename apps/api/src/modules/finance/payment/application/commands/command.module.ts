import { Module } from '@nestjs/common';
import { ChargeTotalsServiceModule } from '@modules/finance/treatment-charge/domain/services/charge-totals';
import { CreatePaymentHandler } from './create-payment/create-payment.handler';
import { CreatePaymentPlanHandler } from './create-payment-plan/create-payment-plan.handler';
import { MarkInstallmentAsPaidHandler } from './mark-installment-as-paid/mark-installment-as-paid.handler';
import { MarkInstallmentAsFailedHandler } from './mark-installment-as-failed/mark-installment-as-failed.handler';
import { MarkInstallmentAsCancelledHandler } from './mark-installment-as-cancelled/mark-installment-as-cancelled.handler';
import { MarkInstallmentAsRefundedHandler } from './mark-installment-as-refunded/mark-installment-as-refunded.handler';
import { BeginInstallmentReversalHandler } from './begin-installment-reversal/begin-installment-reversal.handler';
import { ReleaseInstallmentReversalHandler } from './release-installment-reversal/release-installment-reversal.handler';
import { ChargeBackInstallmentHandler } from './charge-back-installment/charge-back-installment.handler';
import { PaymentInfrastructureModule } from '@modules/finance/payment/infrastructure/infrastructure.module';

const CommandHandlers = [
  CreatePaymentHandler,
  CreatePaymentPlanHandler,
  MarkInstallmentAsPaidHandler,
  MarkInstallmentAsFailedHandler,
  MarkInstallmentAsCancelledHandler,
  MarkInstallmentAsRefundedHandler,
  ChargeBackInstallmentHandler,
  BeginInstallmentReversalHandler,
  ReleaseInstallmentReversalHandler,
];

@Module({
  imports: [PaymentInfrastructureModule, ChargeTotalsServiceModule],
  providers: CommandHandlers,
})
export class PaymentCommandModule {}
