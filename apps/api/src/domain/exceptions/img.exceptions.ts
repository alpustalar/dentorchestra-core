import { DomainException } from '@src/domain/exceptions/domain.exception';
import { ERROR_CODES } from '../../../../../packages/shared/common/constants/error-codes.constant';
import { HttpStatus } from '@nestjs/common';

export class InvalidImageException extends DomainException {
  readonly errorCode = ERROR_CODES.IMG.INVALID;
  public override readonly httpStatus = HttpStatus.UNPROCESSABLE_ENTITY;

  constructor(message = 'Geçersiz görsel formatı.') {
    super(message);
  }
}

export class InsecureImageProtocolException extends DomainException {
  readonly errorCode = ERROR_CODES.IMG.INSECURE_PROTOCOL;
  public override readonly httpStatus = HttpStatus.UNPROCESSABLE_ENTITY;

  constructor(
    message = 'Görsel bağlantısı güvenli (HTTPS) bir protokol kullanmalıdır.'
  ) {
    super(message);
  }
}
