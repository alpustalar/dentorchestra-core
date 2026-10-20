import { DomainException } from '@src/domain/exceptions/domain.exception';
import { ERROR_CODES } from '../../../../../packages/shared/common/constants/error-codes.constant';
import { HttpStatus } from '@nestjs/common';

export class InvalidTimeZoneException extends DomainException<{
  value?: string;
}> {
  readonly errorCode = ERROR_CODES.TIMEZONE.INVALID;
  public override readonly httpStatus = HttpStatus.UNPROCESSABLE_ENTITY;

  constructor(value?: string) {
    super(
      value
        ? `Geçersiz veya desteklenmeyen zaman dilimi: ${value}`
        : 'Geçersiz zaman dilimi sağlandı.',
      { value }
    );
  }
}
