import { HttpStatus } from '@nestjs/common';
import { DomainException } from '@src/domain/exceptions/domain.exception';
import { ERROR_CODES } from '../../../../../../packages/shared/common/constants/error-codes.constant';

/**
 * İşlem bir klinik kapsamı gerektiriyor ama istek hiçbirini taşımıyor.
 *
 * Klinik kapsamı aktörün kimliğinden türetilemez: bir organizasyon sahibi ya da
 * şube müdürü birden çok kliniğe bakar, hangisi adına çalıştığını **istek**
 * söyler. `clinicId` boşken aktörün organizasyonunu kayda damgalamak, kaydı
 * sahipsiz (ya da yanlış şubeye ait) bırakır — bu yüzden kapıda durdurulur.
 */
export class ClinicScopeRequiredException extends DomainException<{
  operation?: string;
}> {
  public readonly errorCode = ERROR_CODES.COMMON.CLINIC_SCOPE_REQUIRED;
  public override readonly httpStatus = HttpStatus.BAD_REQUEST;

  constructor(operation?: string) {
    super(
      'Bu işlem bir klinik (şube) seçilmesini gerektiriyor; istekte klinik bilgisi yok.',
      { operation }
    );
  }
}
