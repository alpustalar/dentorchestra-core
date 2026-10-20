import { ERROR_CODES } from '../../../../../../../../../packages/shared/common/constants/error-codes.constant';
import { HttpStatus } from '@nestjs/common';
import { DomainException } from '@src/domain/exceptions/domain.exception';

export class HotelbedsTransferAlreadyCancelledException extends DomainException<{
  bookingReference?: string;
}> {
  readonly errorCode = ERROR_CODES.HOTELBEDS_TRANSFER.ALREADY_CANCELLED;
  public override readonly httpStatus = HttpStatus.CONFLICT;

  constructor(bookingReference?: string) {
    super('Transfer rezervasyonu zaten iptal edilmiş.', { bookingReference });
  }
}

export class HotelbedsTransferNotFound extends DomainException {
  readonly errorCode = ERROR_CODES.HOTELBEDS_TRANSFER.ALREADY_CANCELLED;
  public override readonly httpStatus = HttpStatus.NOT_FOUND;

  constructor() {
    super('Transfer rezervasyonu bulunamadı.');
  }
}
