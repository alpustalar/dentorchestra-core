import { DomainException } from '@src/domain/exceptions/domain.exception';
import { ERROR_CODES } from '../../../../../packages/shared/common/constants/error-codes.constant';
import { HttpStatus } from '@nestjs/common';

export class InvalidFirebaseUidException extends DomainException {
  readonly errorCode = ERROR_CODES.FIREBASE_UID.INVALID;
  public override readonly httpStatus = HttpStatus.UNPROCESSABLE_ENTITY;

  constructor(message = 'Geçersiz Firebase UID değeri sağlandı.') {
    super(message);
  }
}
