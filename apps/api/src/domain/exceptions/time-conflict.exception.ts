import { DomainException } from '@src/domain/exceptions/domain.exception';
import { HttpStatus } from '@nestjs/common';
import { ERROR_CODES } from '../../../../../packages/shared/common/constants/error-codes.constant';

export class TimeConflictException extends DomainException {
  public readonly errorCode = ERROR_CODES.SHARED.TIME_CONFLICT;
  public override readonly httpStatus = HttpStatus.CONFLICT;
  constructor(message = 'Zaman çakışması oluştu') {
    super(message);
  }
}
