import { Decimal } from 'decimal.js';
import { z } from 'zod';
import {
  CurrencySchema,
  CurrencyType,
} from '@input-type-schemas/CurrencySchema';
import {
  CurrencyMismatchException,
  InsufficientFundsException,
  InvalidAllocationCountException,
  InvalidFxRateException,
  InvalidMoneyAmountException,
} from '@src/domain/exceptions/money.exceptions';
import { isEmpty } from '@common/utils';

export class Money {
  /** Kuruş ölçeği — para kolonları `Decimal(x,2)`. */
  static readonly PRECISION = 2;

  /**
   * Para yuvarlama **modu** — projede tek kaynak.
   *
   * `decimal.js`'in global varsayılanı da bugün `ROUND_HALF_UP`'tır, ama bu
   * varsayılan `Decimal.set({ rounding })` ile her yerden değiştirilebilir ve
   * mod geçilmeden yazılmış her `toDecimalPlaces(2)` çağrısı o anda sessizce
   * başka davranır. Modu açıkça taşımak, para aritmetiğini **görünmez bir global
   * ayardan** kurtarır (CLAUDE.md finans kuralı 12: kabul/dönüşüm kuralı tek
   * sabitte yaşar, kopya yazılmaz).
   *
   * Yarıyı yukarı: KDV ve indirim hesaplarında mükellef lehine/aleyhine
   * sistematik sapma üretmeyen, TDHP uygulamasında yerleşik olan mod.
   */
  static readonly ROUNDING = Decimal.ROUND_HALF_UP;

  private static readonly schema = z
    .object({
      amount: z.custom<Decimal>((val) => val instanceof Decimal),
      currency: CurrencySchema,
    })
    .refine((data) => data.amount.isFinite(), {
      // NaN/Infinity sessizce geçerse tüm zincire (tutar, minor unit, defter satırı)
      // bulaşır: `new Decimal(NaN).isNegative()` false döndüğü için negatiflik
      // kontrolü bunu yakalamaz.
      message: 'Para miktarı geçerli bir sayı olmalıdır.',
    })
    .refine((data) => !data.amount.isNegative(), {
      message: 'Para miktarı negatif olamaz.',
    });

  private readonly _value: Decimal;
  private readonly _currency: CurrencyType;

  private constructor(amount: Decimal, currency: CurrencyType) {
    this._value = amount;
    this._currency = currency;
    Object.freeze(this);
  }

  /**
   * 🎯 2. Static Validate (Getter): Sınıf düzeyinde ham verinin şemaya uygunluğunu doğrular
   * Örn: Money.validate.input(dto.amount, dto.currency).orThrow()
   */
  public static get validate() {
    return {
      input: (amount: string | number | Decimal, currency: CurrencyType) => {
        const decimalAmount =
          amount instanceof Decimal ? amount : new Decimal(amount);
        const normalizedCurrency = currency?.trim().toUpperCase();

        const result = Money.schema.safeParse({
          amount: decimalAmount,
          currency: normalizedCurrency,
        });

        return {
          isValid: result.success,
          isInvalid: !result.success,
          orThrow: (exception?: Error) => {
            if (!result.success) {
              throw (
                exception ??
                new InvalidMoneyAmountException(result.error.message)
              );
            }
            return result.data;
          },
        };
      },
    };
  }

  /**
   * Bir Decimal'i kuruş ölçeğine yuvarlar — **para yuvarlamasının tek kapısı**.
   *
   * Ham `toDecimalPlaces(2)` yerine bu kullanılır: ölçek ve mod birlikte, tek
   * sabitten gelir. Yüzde/oran gibi para olmayan büyüklükler buradan geçmez
   * (onların ölçeği farklıdır — ör. kur 6 hane, oran 1 hane).
   */
  public static scale(value: Decimal): Decimal {
    return value.toDecimalPlaces(Money.PRECISION, Money.ROUNDING);
  }

  /**
   * Tutar kuruş ölçeğinde mi (en çok iki ondalık hane)?
   *
   * Para kolonları `Decimal(x,2)`: üçüncü basamak taşıyan bir tutar hata vermez,
   * **sessizce yuvarlanır**. Yuvarlama tek başına zararsız görünür ama saklanan
   * değer, uygulamanın doğruladığı değerden farklı olur — yevmiyede bu, Σborç =
   * Σalacak özdeşliğinin *doğrulandıktan sonra* bozulması demektir (10.005 +
   * 89.995 = 100.00 doğrulanır, 10.01 + 90.00 ≠ 100.00 saklanır).
   *
   * Yüklem (predicate) olarak durur, exception fırlatmaz: her katman kendi
   * tipli hatasını fırlatır (kasada `CashInvalidPrecisionException`, yevmiyede
   * `InvalidJournalLineAmountException`) — ölçünün tanımı tek yerde, hatanın
   * kimliği kendi yerinde kalır.
   */
  public static isKurusScaled(value: Decimal): boolean {
    return value.decimalPlaces() <= Money.PRECISION;
  }

  public get value(): Decimal {
    return this._value;
  }

  public get currency(): CurrencyType {
    return this._currency;
  }

  public get validate() {
    return {
      greaterThanZero: (() => {
        const isGreaterThanZero =
          this.value.isPositive() && !this.value.isZero();
        return {
          isValid: isGreaterThanZero,
          orThrow: (message?: string): Money => {
            if (!isGreaterThanZero) {
              throw new InvalidMoneyAmountException(message);
            }
            return this;
          },
        };
      })(),
    };
  }

  public static fromTrusted(
    amount: number | string | Decimal,
    currency: CurrencyType
  ): Money {
    return new Money(
      amount instanceof Decimal ? amount : new Decimal(amount),
      currency
    );
  }

  public static create(
    amount: number | string | Decimal | null | undefined,
    currencyStr: CurrencyType
  ) {
    const isBlank = isEmpty(amount);

    const validated = isBlank
      ? false
      : Money.validate.input(amount, currencyStr).isValid;

    const normalizeAmount = isBlank ? null : new Decimal(amount);

    const instance =
      validated && normalizeAmount
        ? new Money(normalizeAmount, currencyStr)
        : undefined;

    return {
      instance,

      orThrow(exception?: Error): Money {
        if (!validated || !instance) {
          throw exception ?? new InvalidMoneyAmountException();
        }
        return instance;
      },
    };
  }

  public toApiFormat(): string {
    return this._value.toFixed(2);
  }

  /**
   * Kuruşa yuvarlar (2 hane, yarıyı yukarı).
   *
   * `multiply` bilerek yuvarlamaz — ara hesaplarda (birim fiyat × kesirli adet)
   * duyarlılık korunmalı. Ama **satır tutarı** olarak kullanılacak bir Money
   * mutlaka buradan geçirilir: DB kolonları `Decimal(x,2)` ve satırdan türeyen
   * indirim/matrah da 2 haneye yuvarlanıyor. Ham çarpımı yuvarlamadan bırakmak,
   * "liste − indirim = matrah" eşitliğini toplamda bir kuruş kaydırır.
   */
  public round(): Money {
    return new Money(Money.scale(this._value), this._currency);
  }

  public applyPercentage(percentage: number | string | Decimal): Money {
    const p = new Decimal(percentage).div(100);
    const increase = this._value.mul(p);
    return new Money(this._value.add(increase), this._currency);
  }

  public allocate(count: number): Money[] {
    if (count <= 0) {
      throw new InvalidAllocationCountException(count);
    }
    const total = this._value;
    const each = Money.scale(total.div(count));
    const remainder = total.sub(each.mul(count));

    const results = Array.from(
      { length: count },
      () => new Money(each, this._currency)
    );

    if (!remainder.isZero()) {
      results[0] = new Money(results[0].value.add(remainder), this._currency);
    }

    return results;
  }

  public format(locale: string = 'tr-TR'): string {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: this._currency,
    }).format(this._value.toNumber());
  }

  public add(other: Money): Money {
    this.checkCurrencyMatch(other);
    return new Money(this._value.add(other._value), this._currency);
  }

  public isGreaterThan(other: Money): boolean {
    this.checkCurrencyMatch(other);
    return this._value.greaterThan(other._value);
  }

  public subtract(other: Money): Money {
    this.checkCurrencyMatch(other);
    const result = this._value.sub(other._value);

    if (result.isNegative()) {
      throw new InsufficientFundsException();
    }
    return new Money(result, this._currency);
  }

  public multiply(quantity: number | Decimal): Money {
    const q = new Decimal(quantity);
    return new Money(this._value.mul(q), this._currency);
  }

  /**
   * Tutarı **başka bir para birimine** çevirir: kur ile çarpar, kuruşa yuvarlar
   * ve sonucun para birimini hedef cinse çevirir.
   *
   * Neden ayrı bir kapı: `multiply` para birimini bilerek **korur** (birim fiyat
   * × adet aynı cinstendir). Kurla `multiply` edip etiketi değiştirmemek, TRY
   * tutarı taşıyan ama kendini EUR sanan bir `Money` üretir — o noktadan sonra
   * `add`/`subtract`/`isGreaterThan` guard'ı koruma değil **tuzak** olur: iki
   * "EUR" sorunsuz toplanır, biri aslında TRY'dir ve hiçbir kontrol uyarmaz.
   * Çevrim bu yüzden adını söyleyen tek bir yerden geçer.
   *
   * Yuvarlama burada yapılır çünkü çevrilmiş tutar daima bir **satır tutarıdır**
   * (defter satırı / DB `Decimal(x,2)`); ham çarpımı taşımak toplamı bir kuruş
   * kaydırır (bkz. {@link round}).
   */
  public convert(rate: number | Decimal, to: CurrencyType): Money {
    const r = new Decimal(rate);
    if (!r.isFinite() || r.lessThanOrEqualTo(0)) {
      throw new InvalidFxRateException(r.toString());
    }
    return new Money(Money.scale(this._value.mul(r)), to);
  }

  public calculateVat(vatRate: number | string | Decimal): Money {
    const rate = new Decimal(vatRate).div(100);
    return new Money(this._value.mul(rate), this._currency);
  }

  public equals(other: Money): boolean {
    return (
      this._currency === other._currency && this._value.equals(other._value)
    );
  }

  private checkCurrencyMatch(other: Money): void {
    if (this._currency !== other._currency) {
      throw new CurrencyMismatchException(this.currency, other.currency);
    }
  }
}
