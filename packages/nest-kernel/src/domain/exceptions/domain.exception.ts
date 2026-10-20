import { HttpStatus } from '@nestjs/common';
import type { ErrorCode } from '../../../../shared/common/constants/error-codes.constant';

/**
 * Tüm domain/application iş-mantığı hatalarının taban sınıfı. Bu katmanlar (handler,
 * service, use-case, entity) HTTP protokolünden izoledir; NestJS HTTP exception'ları
 * (`BadRequestException` vb.) kullanılmaz — bunun yerine `DomainException`'dan türetilmiş,
 * `errorCode` barındıran özel hatalar fırlatılır.
 *
 * - `errorCode` her zaman `ERROR_CODES` merkezi sabitinden gelir; tip `ErrorCode` union'ı
 *   olduğu için ERROR_CODES'ta tanımlı olmayan bir kod yazmak derleme hatasıdır.
 * - `httpStatus` her exception tarafından polimorfik olarak belirlenir; override edilmezse
 *   varsayılan `400`. Eşleme tek yerde (merkezi lookup) değil, exception'ın kendisindedir.
 * - `meta` frontend'in akıllı karar alabilmesi için strongly-typed jenerik payload taşır.
 *
 * `HttpStatus` yalnızca sayısal bir enum (runtime framework bağımlılığı değil); status
 * kodlarını tip-güvenli tutmak için domain'de kullanımına izin verilir.
 */
export abstract class DomainException<
  TMeta extends Record<string, any> = Record<string, never>,
> extends Error {
  public abstract readonly errorCode: ErrorCode;

  /** Alt sınıf override etmezse varsayılan 400. */
  public readonly httpStatus: HttpStatus = HttpStatus.BAD_REQUEST;

  /** Frontend'in akıllı karar almasını sağlayan strongly-typed metadata. */
  public readonly meta?: TMeta;

  protected constructor(message: string, meta?: any) {
    super(message);
    this.meta = meta;
    this.name = new.target.name;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
