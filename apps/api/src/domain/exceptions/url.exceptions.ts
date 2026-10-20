import { DomainException } from '@src/domain/exceptions/domain.exception';
import { ERROR_CODES } from '../../../../../packages/shared/common/constants/error-codes.constant';
import { HttpStatus } from '@nestjs/common';

export class InvalidUrlException extends DomainException {
  public readonly errorCode = ERROR_CODES.URL.INVALID;
  override httpStatus = HttpStatus.UNPROCESSABLE_ENTITY;
  constructor(message?: string) {
    super(`Geçersiz URL: ${message}`);
  }
}
