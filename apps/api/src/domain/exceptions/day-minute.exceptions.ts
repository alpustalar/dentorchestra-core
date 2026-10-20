import { DomainException } from '@src/domain/exceptions/domain.exception';
import { ERROR_CODES } from '../../../../../packages/shared/common/constants/error-codes.constant';
import { HttpStatus } from '@nestjs/common';

export class InvalidTimeFormatException extends DomainException<{
  timeString: string;
}> {
  readonly errorCode = ERROR_CODES.DAY_MINUTE.INVALID_FORMAT;
  public override readonly httpStatus = HttpStatus.UNPROCESSABLE_ENTITY;

  constructor(timeString: string) {
    super(`Geçersiz saat formatı: ${timeString}. Örn: "09:30"`, { timeString });
  }
}

export class DayMinuteOutOfRangeException extends DomainException<{
  minute: number;
}> {
  readonly errorCode = ERROR_CODES.DAY_MINUTE.OUT_OF_RANGE;
  public override readonly httpStatus = HttpStatus.UNPROCESSABLE_ENTITY;

  constructor(minute: number) {
    super(
      `Geçersiz gün dakikası (${minute}). Değer 0 ile 1439 arasında olmalıdır.`,
      { minute }
    );
  }
}

export class InvalidTimeValueException extends DomainException<{
  timeString: string;
}> {
  readonly errorCode = ERROR_CODES.DAY_MINUTE.INVALID_TIME_VALUE;
  public override readonly httpStatus = HttpStatus.UNPROCESSABLE_ENTITY;

  constructor(timeString: string) {
    super('Geçersiz saat değerleri', { timeString });
  }
}
