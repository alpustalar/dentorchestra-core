import { HttpStatus } from '@nestjs/common';
import { DomainException } from '@src/domain/exceptions/domain.exception';
import { ERROR_CODES } from '../../../../../../packages/shared/common/constants/error-codes.constant';

/**
 * İşlem bir organizasyon kapsamı gerektiriyor ama ne istek ne de aktörün
 * kendi bağlamı bir `organizationId` taşıyor.
 *
 * Aktörün organizasyonu her zaman `ActorContext.organizationId`'den
 * türetilemez (alan opsiyoneldir); istekte de açık bir `organizationId`
 * yoksa kapsam belirsizdir ve sessizce boş bir sonuç veya başka bir
 * organizasyonun verisi dönmek yerine kapıda durdurulur.
 */
export class OrganizationScopeRequiredException extends DomainException<{
  operation?: string;
}> {
  public readonly errorCode = ERROR_CODES.COMMON.ORGANIZATION_SCOPE_REQUIRED;
  public override readonly httpStatus = HttpStatus.BAD_REQUEST;

  constructor(operation?: string) {
    super(
      'Bu işlem bir organizasyon seçilmesini gerektiriyor; istekte veya aktör bağlamında organizasyon bilgisi yok.',
      { operation }
    );
  }
}
