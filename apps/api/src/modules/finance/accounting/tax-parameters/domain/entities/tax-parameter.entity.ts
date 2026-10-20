import { TaxParameter as ITaxParameter } from '@shared';
import { Decimal } from 'decimal.js';
import { AggregateRoot } from '@common/domain/aggregate-root';
import { CreateTaxParameterProps } from '@modules/finance/accounting/tax-parameters/domain/contracts/tax-parameter';
import { TaxParameterKeyType as TaxParameterKey } from '@input-type-schemas/TaxParameterKeySchema';
import { UUID } from '@src/domain/value-objects/uuid.vo';
import { DateTimeManager } from '@shared/common/utils/date-time/date-time.manager';
import {
  STATUTORY_VAT_RATES,
  TAX_RATE_MAX_DECIMAL_PLACES,
} from '@src/domain/constants/tax';
import {
  InvalidTaxRateException,
  InvalidTaxValidityRangeException,
  TaxParameterAlreadyClosedException,
} from '@modules/finance/accounting/tax-parameters/domain/exceptions';

/**
 * Parametrik vergi oranı. (clinicId, key) için tarih-versiyonlu bir oran satırı.
 * `validTo = null` → hâlâ yürürlükteki (açık) sürüm. Yeni oran açılınca eski sürüm
 * `close()` ile kapatılır; geçmiş dönemler doğru hesaplansın diye satır silinmez.
 */

// TODO: DB SEED'le başlangıç verisi eklenecek.
//  (SEED): Diş kliniği / sağlık ERP vergi parametreleri başlangıç verisi kurgulanacak: VAT_HEALTH (%10): Sağlık & Tıbbi Diş Tedavileri KDV
//  VAT_STANDARD (%20): Estetik Diş Beyazlatma & Genel KDV
//  VAT_REDUCED (%1): İndirimli Tıbbi Sarf / İlaç KDV
//  VAT_ZERO (%0): Sağlık Turizmi / İstisna KDV
//  WITHHOLDING_INCOME (%20): Hekim Serbest Meslek Stopajı (GVK 94/2)
//  WITHHOLDING_RENT (%20): Mülk Kira Stopajı
//  CORPORATE_TAX (%25): Kurumlar Vergisi, Not: Tüm varsayılan veriler `validFrom = 2026-01-01 00:00:00` ve `validTo = null` ile seed edilmelidir.
export class TaxParameter extends AggregateRoot {
  constructor(data: ITaxParameter) {
    super();
    this._id = data.id;
    this._clinicId = data.clinicId;
    this._organizationId = data.organizationId;
    this._key = data.key;
    this._rate = data.rate;
    this._validFrom = data.validFrom;
    this._validTo = data.validTo;
    this._createdAt = data.createdAt;
    this._updatedAt = data.updatedAt;
  }

  private _id: string;
  get id(): string {
    return this._id;
  }

  private _clinicId: string;
  get clinicId(): string {
    return this._clinicId;
  }

  private _organizationId: string;
  get organizationId(): string {
    return this._organizationId;
  }

  private _key: TaxParameterKey;
  get key(): TaxParameterKey {
    return this._key;
  }

  private _rate: Decimal;
  get rate(): Decimal {
    return this._rate;
  }

  private _validFrom: Date;
  get validFrom(): Date {
    return this._validFrom;
  }

  private _validTo: Date | null;
  get validTo(): Date | null {
    return this._validTo;
  }

  private _createdAt: Date;
  get createdAt(): Date {
    return this._createdAt;
  }

  private _updatedAt: Date;
  get updatedAt(): Date {
    return this._updatedAt;
  }

  /** Oranın sayısal (yüzde) değeri. */
  get rateNumber(): number {
    return this._rate.toNumber();
  }

  public static create(props: CreateTaxParameterProps): TaxParameter {
    TaxParameter.assertValidRate(props.key, props.rate);
    if (props.validTo && props.validTo <= props.validFrom) {
      throw new InvalidTaxValidityRangeException(
        props.validFrom,
        props.validTo
      );
    }

    const now = DateTimeManager.create();
    return new TaxParameter({
      id: UUID.createOrGenerate(props.id).value,
      clinicId: props.clinicId,
      organizationId: props.organizationId,
      key: props.key,
      rate: new Decimal(props.rate),
      validFrom: props.validFrom,
      validTo: props.validTo ?? null,
      createdAt: now,
      updatedAt: now,
    });
  }

  /** KDV anahtarları yasal orana bağlıdır; stopaj/kurumlar için sabit küme yoktur. */
  private static isVatKey(key: TaxParameterKey): boolean {
    return key.startsWith('VAT_');
  }

  /**
   * Oranı **yazma kapısında** doğrular.
   *
   * KDV anahtarlarında yasal küme (`STATUTORY_VAT_RATES`) zorlanır. Eskiden burada
   * yalnız 0–100 aralığı kontrol ediliyordu; oysa oranın gerçekte kullanıldığı yer
   * (`VatRate` VO) aynı listeyi kopya olarak taşıyıp yasal olmayan değeri
   * reddediyordu. Sonuç: %8 gibi bir oran parametre tablosuna sorunsuz yazılıyor,
   * hata **fatura kesilirken** ve sebebinden kopuk bir mesajla ortaya çıkıyor,
   * faturalama duruyordu. Kontrol kapıya alındığında kullanılamaz bir oran hiç
   * kaydedilemez.
   *
   * KDV dışı oranlarda (stopaj, kurumlar vergisi) yasal küme yoktur; sınır DB
   * kolonundan gelir: 0–100 ve en çok 2 ondalık basamak (`Decimal(5,2)`).
   */
  private static assertValidRate(key: TaxParameterKey, rate: number): void {
    if (Number.isNaN(rate) || rate < 0 || rate > 100) {
      throw new InvalidTaxRateException(key, rate, '0-100');
    }

    if (TaxParameter.isVatKey(key)) {
      if (!STATUTORY_VAT_RATES.includes(rate)) {
        throw new InvalidTaxRateException(
          key,
          rate,
          STATUTORY_VAT_RATES.join(' / ')
        );
      }
      return;
    }

    if (new Decimal(rate).decimalPlaces() > TAX_RATE_MAX_DECIMAL_PLACES) {
      throw new InvalidTaxRateException(
        key,
        rate,
        `en çok ${TAX_RATE_MAX_DECIMAL_PLACES} ondalık basamak`
      );
    }
  }

  /**
   * Yeni bir oran yürürlüğe girince bu (açık) sürümü kapatır.
   *
   * Zaten kapalıysa **sesli hata** verir. Eskiden sessizce geri dönüyordu ve bu,
   * eşzamanlı iki güncellemede çift açık sürüm üreten hatayı tam olarak gizleyen
   * şeydi: ikinci istek kilidi aldıktan sonra satırı kapalı görüyor, `close()`
   * hiçbir şey yapmıyor, ama yeni sürüm yine açılıyordu.
   */
  public close(validTo: Date): void {
    if (this._validTo) {
      throw new TaxParameterAlreadyClosedException(this._id, this._validTo);
    }
    if (validTo < this._validFrom) {
      throw new InvalidTaxValidityRangeException(this._validFrom, validTo);
    }
    this._validTo = validTo;
    this._updatedAt = DateTimeManager.create();
  }

  /**
   * Verilen tarihte bu oran yürürlükte mi? Aralık **yarı açık**: `[validFrom, validTo)`.
   *
   * `validTo` dahil sayılırsa, kapanan sürümün `validTo`'su yeni sürümün
   * `validFrom`'una eşit olduğu için (bkz. `close`) tam o anda **iki** sürüm birden
   * yürürlükte görünür. Sıralamaya güvenmek bunu yalnız gizler; aralığın dışlayıcı
   * olması tanımı tekilleştirir.
   */
  public isEffectiveAt(date: Date): boolean {
    if (date < this._validFrom) return false;
    return this._validTo === null || date < this._validTo;
  }

  public toPersistence(): ITaxParameter {
    return {
      id: this.id,
      clinicId: this.clinicId,
      organizationId: this.organizationId,
      key: this.key,
      rate: this.rate,
      validFrom: this.validFrom,
      validTo: this.validTo,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
