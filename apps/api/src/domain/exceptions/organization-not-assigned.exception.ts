import { DomainException } from '@src/domain/exceptions/domain.exception';
import { HttpStatus } from '@nestjs/common';
import { ERROR_CODES } from '../../../../../packages/shared/common/constants/error-codes.constant';

export class OrganizationNotAssignedException extends DomainException {
  public readonly errorCode = ERROR_CODES.AUTH.ORGANIZATION_NOT_ASSIGNED;

  public override readonly httpStatus = HttpStatus.BAD_REQUEST;

  constructor(
    message = 'İşlemi gerçekleştiren kullanıcı için bir organizasyon tanımlanmamış.'
  ) {
    super(message);
  }
}
