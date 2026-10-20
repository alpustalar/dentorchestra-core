import { DomainException } from '@src/domain/exceptions/domain.exception';
import { ERROR_CODES } from '../../../../../../../../packages/shared/common/constants/error-codes.constant';
import { HttpStatus } from '@nestjs/common';

export class ClinicNotFoundException extends DomainException {
  public errorCode = ERROR_CODES.CLINIC.NOT_FOUND;
  public override httpStatus = HttpStatus.NOT_FOUND;
  constructor() {
    super('Klinik bulunamadı');
  }
}

/**
 * İstekte gelen `organizationId`, `clinicId`'nin gerçekte bağlı olduğu
 * organizasyonla uyuşmuyor.
 *
 * `TenantScopeInput.organizationId` istemciden gelebilen bir alandır; doğrulanmadan
 * kabul edilirse aktör kendi kliniğinin kimliğiyle **başka bir kiracının**
 * organizasyon kimliğini eşleştirip kaydı o kiracının org-kapsamlı listelerine
 * enjekte edebilir. Uyuşmazlık ya saldırıdır ya da istemci hatasıdır; ikisi de
 * sessizce düzeltilmez, kapıda durdurulur.
 */
export class TenantScopeMismatchException extends DomainException<{
  clinicId: string;
  organizationId: string;
}> {
  public errorCode = ERROR_CODES.CLINIC.TENANT_SCOPE_MISMATCH;
  public override httpStatus = HttpStatus.FORBIDDEN;

  constructor(clinicId: string, organizationId: string) {
    super(
      'Gönderilen organizasyon, kliniğin bağlı olduğu organizasyonla uyuşmuyor.',
      { clinicId, organizationId }
    );
  }
}
