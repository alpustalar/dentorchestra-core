import Iyzipay from 'iyzipay';

export interface CreateCheckoutFormRequest extends Omit<
  Iyzipay.PaymentRequestData,
  'installments' | 'paymentCard'
> {
  callbackUrl: string;
  enabledInstallments?: number[];
}
