import { ERROR_CODES } from '../../../../../packages/shared/common/constants/error-codes.constant';
import { HttpStatus } from '@nestjs/common';
import { DomainException } from '@src/domain/exceptions/domain.exception';

export class InvalidLatitudeException extends DomainException<{
  latitude: number;
}> {
  readonly errorCode = ERROR_CODES.COORDINATES.INVALID_LATITUDE;
  public override readonly httpStatus = HttpStatus.UNPROCESSABLE_ENTITY;

  constructor(latitude: number) {
    super(`Geçersiz enlem değeri. Değer -90 ile 90 arasında olmalıdır.`, {
      latitude,
    });
  }
}

export class InvalidLongitudeException extends DomainException<{
  longitude: number;
}> {
  readonly errorCode = ERROR_CODES.COORDINATES.INVALID_LONGITUDE;
  public override readonly httpStatus = HttpStatus.UNPROCESSABLE_ENTITY;

  constructor(longitude: number) {
    super(`Geçersiz boylam değeri. Değer -180 ile 180 arasında olmalıdır.`, {
      longitude,
    });
  }
}

export class InvalidCoordinatesFormatException extends DomainException<{
  format?: string;
}> {
  readonly errorCode = ERROR_CODES.COORDINATES.INVALID_FORMAT;
  public override readonly httpStatus = HttpStatus.UNPROCESSABLE_ENTITY;

  constructor(format?: string) {
    super(`Geçersiz koordinat formatı. "enlem,boylam" formatında olmalıdır.`, {
      format,
    });
  }
}
