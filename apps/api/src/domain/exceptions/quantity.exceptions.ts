import { ERROR_CODES } from '../../../../../packages/shared/common/constants/error-codes.constant';
import { DomainException } from '@src/domain/exceptions/domain.exception';

export class QuantityNegativeException extends DomainException<{
  context?: string;
}> {
  readonly errorCode = ERROR_CODES.QUANTITY.NEGATIVE;
  constructor(context?: string) {
    super(
      context ? `${context} miktarı negatif olamaz.` : 'Miktar negatif olamaz.',
      { context }
    );
  }
}

export class QuantityNotGreaterThanZeroException extends DomainException<{
  context?: string;
}> {
  readonly errorCode = ERROR_CODES.QUANTITY.NOT_GREATER_THAN_ZERO;
  constructor(context?: string) {
    super(
      context
        ? `${context} miktarı sıfırdan büyük olmalıdır.`
        : 'Miktar sıfırdan büyük olmalıdır.',
      { context }
    );
  }
}

export class QuantityInsufficientException extends DomainException<{
  context?: string;
  current?: string;
  delta?: string;
}> {
  readonly errorCode = ERROR_CODES.QUANTITY.INSUFFICIENT;
  constructor(current?: string, delta?: string, context?: string) {
    super(context ? `${context} için yetersiz miktar.` : 'Yetersiz miktar.', {
      context,
      current,
      delta,
    });
  }
}
