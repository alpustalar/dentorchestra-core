import { ERROR_CODES } from '../../../../../packages/shared/common/constants/error-codes.constant';
import { HttpStatus } from '@nestjs/common';
import { DomainException } from '@src/domain/exceptions/domain.exception';

export class InvalidDateRangeException extends DomainException<{
  start?: Date;
  end?: Date;
}> {
  readonly errorCode = ERROR_CODES.DATE_RANGE.INVALID_ORDER;
  public override readonly httpStatus = HttpStatus.UNPROCESSABLE_ENTITY;

  constructor(start?: Date, end?: Date) {
    super(
      'Bitiş tarihi, başlangıç tarihinden önce veya başlangıç tarihine eşit olamaz.',
      { start, end }
    );
  }
}

export class DateRangeExpiredException extends DomainException {
  readonly errorCode = ERROR_CODES.DATE_RANGE.EXPIRED;
  public override readonly httpStatus = HttpStatus.UNPROCESSABLE_ENTITY;

  constructor(message = 'Tarih aralığının süresi dolmuş.') {
    super(message);
  }
}
