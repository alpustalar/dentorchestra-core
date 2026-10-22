import { HttpStatus } from '@nestjs/common';
import { DomainException } from '@src/domain/exceptions/domain.exception';
import { ERROR_CODES } from '@shared/common/constants/error-codes.constant';

export class EDocumentIntegrationNotConfiguredException extends DomainException {
  public readonly errorCode = ERROR_CODES.E_DOCUMENT.INTEGRATION_NOT_CONFIGURED;
  public override readonly httpStatus = HttpStatus.CONFLICT;

  constructor(clinicId: string) {
    super(
      `Klinik için etkin bir e-belge entegrasyonu yapılandırılmamış: ${clinicId}`
    );
  }
}

export class EDocumentIntegrationConfigNotFoundException extends DomainException {
  public readonly errorCode = ERROR_CODES.E_DOCUMENT.CONFIG_NOT_FOUND;
  public override readonly httpStatus = HttpStatus.NOT_FOUND;

  constructor() {
    super('E-belge entegrasyon ayarı bulunamadı.');
  }
}
