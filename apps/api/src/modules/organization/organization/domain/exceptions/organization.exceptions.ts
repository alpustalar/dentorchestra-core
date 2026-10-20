import { DomainException } from '@src/domain/exceptions/domain.exception';
import { ERROR_CODES } from '../../../../../../../../packages/shared/common/constants/error-codes.constant';
import { HttpStatus } from '@nestjs/common';

export class OrganizationNotFoundException extends DomainException {
  public readonly errorCode = ERROR_CODES.ORGANIZATION.NOT_FOUND;
  public override httpStatus = HttpStatus.NOT_FOUND;
  constructor(id?: string) {
    super('Organizasyon bulunamadı', { id });
  }
}
