import { DomainException } from '@src/domain/exceptions/domain.exception';
import { ERROR_CODES } from '../../../../../packages/shared/common/constants/error-codes.constant';
import { HttpStatus } from '@nestjs/common';

export class InvalidTcknFormatException extends DomainException {
  readonly errorCode = ERROR_CODES.TCKN.INVALID_FORMAT;
  public override readonly httpStatus = HttpStatus.UNPROCESSABLE_ENTITY;

  constructor() {
    super('Geçersiz TCKN formatı.');
  }
}

// @modules/shared/domain/exceptions/invalid-tckn-checksum.exception.ts
export class InvalidTcknChecksumException extends DomainException {
  readonly errorCode = ERROR_CODES.TCKN.INVALID_CHECKSUM;
  public override readonly httpStatus = HttpStatus.UNPROCESSABLE_ENTITY;

  constructor() {
    super('TCKN doğrulama algoritmasına uymuyor.');
  }
}
