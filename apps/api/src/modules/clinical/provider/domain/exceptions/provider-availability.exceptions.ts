import { DomainException } from '@src/domain/exceptions/domain.exception';
import { ERROR_CODES } from '../../../../../../../../packages/shared/common/constants/error-codes.constant';
import { HttpStatus } from '@nestjs/common';

export class InvalidBreakTimeConfigurationException extends DomainException<{
  startTime?: number | null;
  endTime?: number | null;
}> {
  readonly errorCode =
    ERROR_CODES.PROVIDER_AVAILABILITY.INVALID_BREAK_TIME_CONFIGURATION;
  public override readonly httpStatus = HttpStatus.UNPROCESSABLE_ENTITY;

  constructor(startTime?: number | null, endTime?: number | null) {
    super(
      'Mola başlangıç ve bitiş dakikaları ya birlikte doldurulmalı ya da boş bırakılmalıdır.',
      { startTime, endTime }
    );
  }
}

export class BreakTimeOutOfRangeException extends DomainException<{
  breakStart: string;
  breakEnd: string;
  workStart: string;
  workEnd: string;
}> {
  readonly errorCode =
    ERROR_CODES.PROVIDER_AVAILABILITY.BREAK_TIME_OUT_OF_RANGE;
  public override readonly httpStatus = HttpStatus.UNPROCESSABLE_ENTITY;

  constructor(
    breakStart: string,
    breakEnd: string,
    workStart: string,
    workEnd: string
  ) {
    super(
      `Mola aralığı (${breakStart} - ${breakEnd}), mesai saatlerinin (${workStart} - ${workEnd}) dışına taşamaz.`,
      { breakStart, breakEnd, workStart, workEnd }
    );
  }
}
