import { DomainException } from '@src/domain/exceptions/domain.exception';
import { ERROR_CODES } from '../../../../../packages/shared/common/constants/error-codes.constant';
import { HttpStatus } from '@nestjs/common';

export class InvalidPhoneException extends DomainException {
  readonly errorCode = ERROR_CODES.PHONE.INVALID;
  public override readonly httpStatus = HttpStatus.UNPROCESSABLE_ENTITY;

  constructor(message = 'Geçersiz telefon numarası sağlandı.') {
    super(message);
  }
}
