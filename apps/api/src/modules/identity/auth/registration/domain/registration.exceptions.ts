import { DomainException } from '@src/domain/exceptions/domain.exception';
import { ERROR_CODES } from '../../../../../../../../packages/shared/common/constants/error-codes.constant';
import { HttpStatus } from '@nestjs/common';

export class RegistrationConfigurationException extends DomainException {
  public readonly errorCode = ERROR_CODES.REGISTRATION.NOT_COMPLETED;
  public override readonly httpStatus = HttpStatus.NOT_IMPLEMENTED;

  constructor(reason?: string) {
    super('Kayıt tamamlanamadı.', { reason });
  }
}
