import { ERROR_CODES } from '../../../../../packages/shared/common/constants/error-codes.constant';
import { HttpStatus } from '@nestjs/common';
import { DomainException } from '@src/domain/exceptions/domain.exception';

export class InvalidDayMinuteRangeException extends DomainException<{
  start: number;
  end: number;
}> {
  readonly errorCode = ERROR_CODES.DAY_MINUTE_RANGE.INVALID_RANGE_ORDER;
  public override readonly httpStatus = HttpStatus.UNPROCESSABLE_ENTITY;

  constructor(start: number, end: number) {
    super(
      `Geçersiz aralık: Başlangıç zamanı (${start}), bitiş zamanından (${end}) sonra veya eşit olamaz.`,
      {
        start,
        end,
      }
    );
  }
}
