import { DomainException } from '@src/domain/exceptions/domain.exception';
import { ERROR_CODES } from '../../../../../packages/shared/common/constants/error-codes.constant';

export class VatRateNegativeException extends DomainException {
  readonly errorCode = ERROR_CODES.VAT.NEGATIVE;
  constructor() {
    super('KDV oranı negatif olamaz.');
  }
}

export class InvalidVatRateException extends DomainException<{
  rate?: number;
}> {
  readonly errorCode = ERROR_CODES.VAT.INVALID_RATE;
  constructor(rate?: number) {
    super(`Geçersiz KDV oranı: %${rate}. Yasal oranlar: %0, %1, %10, %20`, {
      rate,
    });
  }
}

export class VatRateMustNotBeZeroException extends DomainException {
  readonly errorCode = ERROR_CODES.VAT.MUST_NOT_BE_ZERO;
  constructor() {
    super('Bu işlem için KDV oranı %0 (muaf) olamaz.');
  }
}
