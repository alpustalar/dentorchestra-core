import { DomainException } from '@src/domain/exceptions/domain.exception';
import { ERROR_CODES } from '../../../../../packages/shared/common/constants/error-codes.constant';
import { HttpStatus } from '@nestjs/common';

export class InvalidCurrencyException extends DomainException<{
  currency: string;
}> {
  readonly errorCode = ERROR_CODES.CURRENCY.INVALID;
  public override readonly httpStatus = HttpStatus.UNPROCESSABLE_ENTITY;

  constructor(currency: string) {
    super(`Geçersiz para birimi: ${currency}`, { currency });
  }
}
