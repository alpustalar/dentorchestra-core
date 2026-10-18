import { Decimal } from 'decimal.js';
import { STATUTORY_VAT_RATES } from '@src/domain/constants/tax';
import {
  InvalidVatRateException,
  VatRateMustNotBeZeroException,
  VatRateNegativeException,
} from '@src/domain/exceptions';

export class VatRate {
  // Yasal KDV oranları TEK KAYNAKTAN gelir: aynı liste vergi parametresi yazma
  // kapısında da zorlanıyor (`TaxParameter.assertValidRate`). Burada kopya durduğu
  // sürece iki taraf ayrışabiliyordu: parametre tablosuna yazılabilen bir oran
  // (ör. %8) faturalama anında burada reddediliyor, faturalama duruyordu.
  private static readonly VALID_RATES = STATUTORY_VAT_RATES;
  private readonly _value: Decimal;

  private constructor(value: Decimal) {
    this._value = value;
    Object.freeze(this);
  }

  /**
   * 🎯 Akıllı Factory:
   */
  public static get validate() {
    return {
      input: (value: number | Decimal | null | undefined) => {
        const val =
          value === null || value === undefined
            ? new Decimal(0)
            : new Decimal(value);

        if (val.isNegative())
          return {
            isValid: false,
            error: 'KDV oranı negatif olamaz.',
            type: 'NEGATIVE',
          };
        if (!VatRate.VALID_RATES.includes(val.toNumber()))
          return {
            isValid: false,
            error: 'Yasal olmayan KDV oranı.',
            type: 'INVALID',
          };

        return { isValid: true, data: val };
      },
    };
  }

  public get value(): Decimal {
    return this._value;
  }

  public get asMultiplier(): Decimal {
    // Örn: %20 için 0.20 döner (Matrah hesaplamalarında direkt çarpım için)
    return this._value.div(100);
  }

  public get asTaxMultiplier(): Decimal {
    // Örn: %20 için 1.20 döner (Brütleştirme / KDV dahil tutar hesaplamalarında)
    return new Decimal(1).plus(this.asMultiplier);
  }

  public get validate() {
    return {
      hasTax: (() => {
        const isZeroRate = this.isZero();

        return {
          isValid: !isZeroRate,
          orThrow: (exception?: Error): VatRate => {
            if (isZeroRate) {
              throw exception ?? new VatRateMustNotBeZeroException();
            }
            return this;
          },
        };
      })(),
    };
  }

  /**
   * persisted veri için.
   */
  public static fromTrusted(value: number | string | Decimal): VatRate {
    return new VatRate(value instanceof Decimal ? value : new Decimal(value));
  }

  // 2. Disiplinli Factory
  public static create(value: number | Decimal | null | undefined) {
    const validation = VatRate.validate.input(value);
    const instance = validation.isValid
      ? new VatRate(validation.data!)
      : undefined;

    return {
      instance,
      orThrow(exception?: Error): VatRate {
        if (!instance) {
          // Hata türüne göre spesifik exception fırlatma
          if (validation.type === 'NEGATIVE')
            throw exception ?? new VatRateNegativeException();
          throw exception ?? new InvalidVatRateException();
        }
        return instance;
      },
    };
  }

  public isZero(): boolean {
    return this._value.isZero();
  }

  public equals(other: VatRate): boolean {
    return this._value.equals(other.value);
  }

  public toString(): string {
    return `%${this._value.toString()}`;
  }
}
