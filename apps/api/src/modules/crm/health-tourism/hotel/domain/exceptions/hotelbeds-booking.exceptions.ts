import { ERROR_CODES } from '../../../../../../../../../packages/shared/common/constants/error-codes.constant';
import { HttpStatus } from '@nestjs/common';
import { DomainException } from '@src/domain/exceptions/domain.exception';

export class HotelbedsBookingAlreadyCancelledException extends DomainException<{
  bookingReference?: string;
}> {
  readonly errorCode = ERROR_CODES.HOTELBEDS_BOOKING.ALREADY_CANCELLED;
  public override readonly httpStatus = HttpStatus.CONFLICT;

  constructor(bookingReference?: string) {
    super(`Hotelbeds rezervasyonu zaten iptal edilmiş.`, {
      bookingReference,
    });
  }
}

export class HotelbedsBookingNotFoundException extends DomainException<{
  bookingReference?: string;
}> {
  readonly errorCode = ERROR_CODES.HOTELBEDS_BOOKING.NOT_FOUND;
  public override readonly httpStatus = HttpStatus.NOT_FOUND;

  constructor() {
    super('Hotelbeds rezervasyonu bulunamadı.');
  }
}

/**
 * checkOut, checkIn'den sonra olmalıdır. Eskiden yalnız (hiç `.parse()` edilmeyen)
 * `CreateHotelbedsBookingPropsSchema.refine()` içinde tanımlıydı — domain/contracts
 * Zod'dan interface'e taşınırken keşfedildi ve entity.create()'e taşındı.
 */
export class HotelbedsBookingInvalidDateRangeException extends DomainException<{
  checkIn: string;
  checkOut: string;
}> {
  readonly errorCode = ERROR_CODES.HOTELBEDS_BOOKING.INVALID_DATE_RANGE;

  constructor(checkIn: Date, checkOut: Date) {
    super('Check-out tarihi, check-in tarihinden sonra olmalıdır.', {
      checkIn: checkIn.toISOString(),
      checkOut: checkOut.toISOString(),
    });
  }
}
