import { BaseRules } from '@common/domain/rules/base.rules';
import { Payment } from '@modules/finance/payment/domain/entities/payment.entity';
import { ValidateOptionsType } from '@shared/common/validate-options/validate-options.type';
import { DefaultValidateOptions } from '@common/domain/constants/default-options.constant';
import {
  PaymentNotCancellableException,
  PaymentNotRefundableException,
} from '@modules/finance/payment/domain/exceptions/payment.exceptions';

/**
 * Ödeme düzeyindeki kaba kapılar.
 *
 * ⚠️ Taksit düzeyindeki değişmez kurallar (tahsil edilmemiş taksit iade
 * edilemez, iade edilmiş taksit yeniden tahsil edilemez) burada DEĞİL entity
 * içinde yaşar: bu kurallar `validateOptions.systemOverride` ile atlanabilir
 * olmamalıdır (webhook/iç akışlar sistem bağlamında koşar).
 *
 * Regresyon notu: bu sınıf `payment.validate.status.isCompleted` ifadelerini
 * `!` ile kullanıyordu; o alanlar `Guard<boolean>` **nesnesi** döndüğü için
 * `!nesne` daima `false` oluyor ve her iki kural da "asla geçerli değil"e
 * düşüyordu — iade/iptal normal aktör için tamamen bloke, sistem aktöründe ise
 * (override) hiç kontrol edilmemiş oluyordu.
 */
export class PaymentRules extends BaseRules {
  constructor(
    private readonly payment: Payment,
    public readonly validateOptions: ValidateOptionsType = DefaultValidateOptions
  ) {
    super();
  }

  /** Tahsil edilmiş veya iade süreci başlamış ödeme iptal edilemez. */
  canCancel() {
    const { isCompleted, isRefunded } = this.payment.validate.status;

    return this.evaluate(
      !isCompleted && !isRefunded,
      () => new PaymentNotCancellableException(this.payment.status),
      this.validateOptions
    );
  }

  /**
   * İade yalnız tahsilatı olan ödemede anlamlıdır: COMPLETED (tamamı tahsil)
   * veya PARTIAL (en az bir taksit tahsil). PENDING/CANCELLED ödemede iade
   * edilecek para yoktur; tamamı iade edilmiş ödemede iade edilecek taksit
   * kalmamıştır.
   */
  canRefund() {
    const { isCompleted, isPartial } = this.payment.validate.status;

    return this.evaluate(
      isCompleted || isPartial,
      () => new PaymentNotRefundableException(this.payment.status),
      this.validateOptions
    );
  }
}
