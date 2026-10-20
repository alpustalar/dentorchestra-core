import { DomainException } from '@src/domain/exceptions/domain.exception';
import { ERROR_CODES } from '../../../../../../../../packages/shared/common/constants/error-codes.constant';
import { HttpStatus } from '@nestjs/common';

export class ProviderShiftNotFoundException extends DomainException<{
  providerId?: string;
  date?: Date;
}> {
  readonly errorCode = ERROR_CODES.PROVIDER_SHIFT.NOT_FOUND;
  public override readonly httpStatus = HttpStatus.NOT_FOUND;

  constructor(providerId?: string, date?: Date) {
    super('Uzmanın bu tarihe ait vardiyası bulunmuyor.', { providerId, date });
  }
}

export class AppointmentOutOfShiftException extends DomainException<{
  start: number;
  end: number;
}> {
  readonly errorCode = ERROR_CODES.PROVIDER_SHIFT.OUT_OF_SHIFT;
  constructor(start: number, end: number) {
    super('Randevu saati uzmanın vardiya saatleri dışında.', { start, end });
  }
}

export class AppointmentOverlapsWithBreakException extends DomainException {
  readonly errorCode = ERROR_CODES.PROVIDER_SHIFT.BREAK_OVERLAP;
  constructor() {
    super('Uzmanın bu saatte molası bulunuyor.');
  }
}

export class InvalidProviderBreakConfigurationException extends DomainException {
  readonly errorCode = ERROR_CODES.PROVIDER_SHIFT.INVALID_BREAK_CONFIGURATION;
  public override readonly httpStatus = HttpStatus.UNPROCESSABLE_ENTITY;

  constructor() {
    super(
      'Mola başlangıç ve bitiş saatleri birlikte dolu veya birlikte boş olmalıdır.'
    );
  }
}

export class ProviderBreakOutOfRangeException extends DomainException<{
  breakStart: string;
  breakEnd: string;
  shiftStart: string;
  shiftEnd: string;
}> {
  readonly errorCode = ERROR_CODES.PROVIDER_SHIFT.BREAK_OUT_OF_RANGE;
  public override readonly httpStatus = HttpStatus.UNPROCESSABLE_ENTITY;

  constructor(bStart: string, bEnd: string, sStart: string, sEnd: string) {
    super(
      `Mola aralığı (${bStart} - ${bEnd}), vardiya saatlerinin (${sStart} - ${sEnd}) dışına taşamaz.`,
      {
        breakStart: bStart,
        breakEnd: bEnd,
        shiftStart: sStart,
        shiftEnd: sEnd,
      }
    );
  }
}
