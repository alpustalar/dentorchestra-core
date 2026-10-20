import { ERROR_CODES } from '../../../../../../../../packages/shared/common/constants/error-codes.constant';
import { DomainException } from '@src/domain/exceptions/domain.exception';
import { HttpStatus } from '@nestjs/common';

export class ActivityNotFoundException extends DomainException<{
  activityId?: string;
}> {
  readonly errorCode = ERROR_CODES.ACTIVITY.NOT_FOUND;
  public override readonly httpStatus = HttpStatus.NOT_FOUND;

  constructor(activityId?: string) {
    super('Aktivite bulunamadı.', { activityId });
  }
}

export class ActivityInvalidCompletionException extends DomainException {
  readonly errorCode = ERROR_CODES.ACTIVITY.INVALID_COMPLETION;

  constructor(message = 'Bu aktivite tamamlanamaz.') {
    super(message);
  }
}
