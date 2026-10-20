import { ERROR_CODES } from '../../../../../packages/shared/common/constants/error-codes.constant';
import { DomainException } from '@src/domain/exceptions/domain.exception';
import { HttpStatus } from '@nestjs/common';

export class InvalidVknFormatException extends DomainException {
  readonly errorCode = ERROR_CODES.VKN.INVALID_FORMAT;
  public override readonly httpStatus = HttpStatus.UNPROCESSABLE_ENTITY;

  constructor() {
    super('Geçersiz VKN formatı.');
  }
}

export class InvalidVknChecksumException extends DomainException {
  readonly errorCode = ERROR_CODES.VKN.INVALID_CHECKSUM;
  public override readonly httpStatus = HttpStatus.UNPROCESSABLE_ENTITY;

  constructor() {
    super('VKN doğrulama algoritmasına uymuyor.');
  }
}
