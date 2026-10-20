import { ERROR_CODES } from '../../../../../packages/shared/common/constants/error-codes.constant';
import { HttpStatus } from '@nestjs/common';
import { DomainException } from '@src/domain/exceptions/domain.exception';

export class InvalidEmailException extends DomainException<{ value: string }> {
  readonly errorCode = ERROR_CODES.EMAIL_ADDRESS.INVALID_FORMAT;
  public override readonly httpStatus = HttpStatus.UNPROCESSABLE_ENTITY;

  constructor() {
    super(`Geçersiz e-posta adresi`);
  }
}
