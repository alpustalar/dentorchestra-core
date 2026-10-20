import { DomainException } from '@src/domain/exceptions/domain.exception';
import { HttpStatus } from '@nestjs/common';
import { ERROR_CODES } from '../../../../../packages/shared/common/constants/error-codes.constant';

export class OrganizationIdentityNotFoundException extends DomainException {
  public readonly errorCode = ERROR_CODES.ORGANIZATION.NOT_FOUND;

  public override readonly httpStatus = HttpStatus.NOT_FOUND;

  constructor(
    message = 'İşlem esnasında gerekli olan organizasyon kimliği bulunamadı.'
  ) {
    super(message);
  }
}
