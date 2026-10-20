import { DomainException } from '@src/domain/exceptions/domain.exception';
import { ERROR_CODES } from '../../../../../packages/shared/common/constants/error-codes.constant';
import { HttpStatus } from '@nestjs/common';

export class InvalidPriorityException extends DomainException<{
  priority?: number;
}> {
  readonly errorCode = ERROR_CODES.PRIORITY.INVALID;
  public override readonly httpStatus = HttpStatus.UNPROCESSABLE_ENTITY;

  constructor(priority?: number) {
    super('Öncelik değerleri 1 ve 100 arasında olmalıdır', {
      priority,
    });
  }
}
