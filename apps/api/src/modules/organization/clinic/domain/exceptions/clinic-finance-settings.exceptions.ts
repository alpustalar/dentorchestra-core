import { HttpStatus } from '@nestjs/common';
import { DomainException } from '@src/domain/exceptions/domain.exception';
import { ERROR_CODES } from '../../../../../../../../packages/shared/common/constants/error-codes.constant';

/**
 * Kapanmış mali yılı olan kliniğin işletme biçimi değiştirilemez: hesap planı ve geçmiş yıl
 * devir fişleri eski biçime göre yazıldı; geriye dönük yorumlamak muhasebe kararıdır.
 */
export class ClinicBusinessTypeLockedException extends DomainException {
  public readonly errorCode = ERROR_CODES.CLINIC.BUSINESS_TYPE_LOCKED;
  public override readonly httpStatus = HttpStatus.CONFLICT;

  constructor() {
    super(
      'Kapanmış mali yılı olan kliniğin işletme biçimi değiştirilemez; muhasebe kararı gerekir.'
    );
  }
}
