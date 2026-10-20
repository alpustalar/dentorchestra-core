import { HttpStatus } from '@nestjs/common';
import { DomainException } from '@src/domain/exceptions';
import { ERROR_CODES } from '../../../../../../../../../packages/shared/common/constants/error-codes.constant';
import { TaxParameterKeyType as TaxParameterKey } from '@input-type-schemas/TaxParameterKeySchema';

/**
 * Oran bu parametre türü için geçerli değil.
 *
 * Eskiden `BadRequestException('Vergi oranı 0-100 arasında olmalıdır.')` idi: hem
 * domain katmanı NestJS'e bağımlıydı hem de kontrol fazla gevşekti — KDV
 * anahtarlarına yasal olmayan bir oran (ör. %8) yazılabiliyor, hata faturalama
 * anında `VatRate` VO'sundan geliyordu (bkz. `STATUTORY_VAT_RATES`).
 */
export class InvalidTaxRateException extends DomainException<{
  key: TaxParameterKey;
  rate: string;
  allowed: string;
}> {
  public readonly errorCode = ERROR_CODES.TAX_PARAMETER.INVALID_RATE;
  public override readonly httpStatus = HttpStatus.UNPROCESSABLE_ENTITY;

  constructor(key: TaxParameterKey, rate: number, allowed: string) {
    super(`${key} için geçersiz oran: ${rate}. İzin verilen: ${allowed}.`, {
      key,
      rate: String(rate),
      allowed,
    });
  }
}

/** `validTo <= validFrom` — geçerlilik aralığı boş ya da ters. */
export class InvalidTaxValidityRangeException extends DomainException<{
  validFrom: string;
  validTo: string;
}> {
  public readonly errorCode = ERROR_CODES.TAX_PARAMETER.INVALID_VALIDITY_RANGE;
  public override readonly httpStatus = HttpStatus.UNPROCESSABLE_ENTITY;

  constructor(validFrom: Date, validTo: Date) {
    super('Geçerlilik bitişi, başlangıcından sonra olmalıdır.', {
      validFrom: validFrom.toISOString(),
      validTo: validTo.toISOString(),
    });
  }
}

/**
 * Kapatılmak istenen sürüm zaten kapalı.
 *
 * Bu **eşzamanlılık sinyalidir**, zararsız bir tekrar değil: `close()` eskiden
 * sessizce geri dönüyordu (`if (this._validTo) return;`) ve çağıran, yeni sürümü
 * yine açıyordu → aynı (clinicId, key) için **iki açık sürüm**. Sessiz geri dönüş
 * hatayı tam olarak gizleyen şeydi.
 */
export class TaxParameterAlreadyClosedException extends DomainException<{
  parameterId: string;
  validTo: string;
}> {
  public readonly errorCode = ERROR_CODES.TAX_PARAMETER.ALREADY_CLOSED;
  public override readonly httpStatus = HttpStatus.CONFLICT;

  constructor(parameterId: string, validTo: Date) {
    super(
      'Bu oran sürümü zaten kapatılmış; eşzamanlı bir güncelleme araya girdi. İsteği yeniden gönderin.',
      { parameterId, validTo: validTo.toISOString() }
    );
  }
}

/**
 * Aynı (clinicId, key) için eşzamanlı ikinci bir açık sürüm yazılmaya çalışıldı.
 * Kısmî unique index (`valid_to IS NULL`) tarafından DB'de yakalanır — ilk sürüm
 * hiç yokken kilitlenecek satır da olmadığı için tek gerçek koruma bu kısıttır.
 */
export class TaxParameterConcurrentUpdateException extends DomainException<{
  clinicId: string;
  key: TaxParameterKey;
}> {
  public readonly errorCode = ERROR_CODES.TAX_PARAMETER.CONCURRENT_UPDATE;
  public override readonly httpStatus = HttpStatus.CONFLICT;

  constructor(clinicId: string, key: TaxParameterKey) {
    super(
      `${key} için eşzamanlı bir oran güncellemesi var; isteği yeniden gönderin.`,
      { clinicId, key }
    );
  }
}
