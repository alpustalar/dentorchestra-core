import { BaseRules } from '@common/domain/rules/base.rules';
import { ValidateOptionsType } from '@shared/common/validate-options/validate-options.type';
import { DefaultValidateOptions } from '@common/domain/constants/default-options.constant';
import { FinanceLedgerEntity } from '@modules/finance/finance-ledger/domain/entities/finance-ledger.entity';
import { LedgerStatusSchema } from '@shared/generated-zod';
import { LedgerInvalidStatusTransitionException } from '@modules/finance/finance-ledger/domain/exceptions/finance-ledger.exceptions';

/**
 * Cari kaydın durum geçişi kuralları.
 *
 * Kurallar çıplak `Error` fırlatıyordu (500 + `errorCode` yok); artık tipli
 * domain hatası döner. Asıl invariant entity'nin `syncStatus`'ündedir —
 * burası aynı kararın politika (validateOptions) ile esnetilebilen yüzüdür.
 */
export class FinanceLedgerRules extends BaseRules {
  constructor(
    public readonly financeLedger: FinanceLedgerEntity,
    public readonly validateOptions: ValidateOptionsType = DefaultValidateOptions
  ) {
    super();
  }

  cancel() {
    const isRefunded = this.financeLedger.validate.isRefunded().value;
    return this.evaluate(
      !isRefunded,
      () =>
        new LedgerInvalidStatusTransitionException(
          LedgerStatusSchema.enum.REFUNDED,
          LedgerStatusSchema.enum.CANCELLED,
          'İade edilmiş kayıtlar iptal edilemez.'
        )
    );
  }

  refund() {
    const isCompleted = this.financeLedger.validate.isCompleted().value;
    return this.evaluate(
      isCompleted,
      () =>
        new LedgerInvalidStatusTransitionException(
          this.financeLedger.status,
          LedgerStatusSchema.enum.REFUNDED,
          'Yalnızca tamamlanmış kayıtlar iade edilebilir.'
        )
    );
  }
}
