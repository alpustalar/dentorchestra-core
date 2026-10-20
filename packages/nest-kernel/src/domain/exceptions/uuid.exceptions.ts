import { DomainException } from '@src/domain/exceptions/domain.exception';
import { ERROR_CODES } from '../../../../shared/common/constants/error-codes.constant';
import { HttpStatus } from '@nestjs/common';

export class InvalidUuidException extends DomainException {
  readonly errorCode = ERROR_CODES.UUID.INVALID;
  public override readonly httpStatus = HttpStatus.UNPROCESSABLE_ENTITY;

  constructor(message = 'Geçersiz UUID değeri sağlandı.') {
    super(message);
  }
}
