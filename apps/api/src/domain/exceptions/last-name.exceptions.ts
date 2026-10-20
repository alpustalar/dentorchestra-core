import { DomainException } from '@src/domain/exceptions/domain.exception';
import { ERROR_CODES } from '../../../../../packages/shared/common/constants/error-codes.constant';
import { HttpStatus } from '@nestjs/common';

export class InvalidLastNameException extends DomainException {
  public readonly errorCode = ERROR_CODES.LAST_NAME.INVALID;
  override httpStatus = HttpStatus.UNPROCESSABLE_ENTITY;
  constructor() {
    super('Geçersiz soyadı');
  }
}
