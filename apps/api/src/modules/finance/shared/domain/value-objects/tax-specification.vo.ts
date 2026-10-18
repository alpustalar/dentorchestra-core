import { Money } from '@src/domain/value-objects/money.vo';
import { InvalidTaxSpecificationException } from '@modules/finance/shared/domain/exceptions';
import { z } from 'zod';
import { Decimal } from 'decimal.js';

/** Satır toplamlarından vergi kırılımı kurma girdisi. */
export interface TaxSpecificationFromLineTotalsProps {
  netAmount: Money;
  taxRate: number;
  /** Satır bazında yuvarlanmış KDV'lerin toplamı — **asıl kaynak** budur. */
  taxAmount: Money;
  /** Toplamı üreten satır sayısı; kabul edilebilir yuvarlama payını belirler. */
  lineCount: number;
}

/**
 * Matrah / vergi / brüt üçlüsü.
 *
 * Üç ayrı fabrika var ve her biri **verginin otoritesini** adıyla söylüyor:
 *
 * | Fabrika           | Otorite                        | Çapraz kontrol                      |
 * | ----------------- | ------------------------------ | ----------------------------------- |
 * | `create`          | oran (matrahtan hesaplanır)    | — (hesabın kendisi)                 |
 * | `fromGrossAmount` | brüt tutar (orana göre ayrılır)| — (artık matrahtan düşülür)         |
 * | `fromLineTotals`  | **satırlar**                   | satır sayısına bağlı yuvarlama payı |
 * | `fromTrusted`     | veritabanı                     | **yok** (bkz. aşağıdaki not)        |
 *
 * Eskiden tek bir `create(net, rate, customTaxAmount?)` vardı ve verilen tutarı
 * `net × oran` ile **sabit 2 kuruş** toleransla karşılaştırıyordu. İki ayrı hata
 * üretiyordu:
 *
 * 1. **Çok satırlı fatura kesilemiyordu.** KDV yasal olarak satır bazında
 *    yuvarlanır (e-fatura kalem bazlı KDV bekler), bu yüzden `Σ round(net_i × r)`
 *    ile `(Σ net_i) × r` satır sayısı arttıkça ayrışır. 10 satır × 33,33 TRY @ %20
 *    → satır toplamı 66,70 / orandan hesap 66,66 → fark 4 kuruş > 2 kuruş →
 *    `Vergi tutarı uyuşmuyor` ile fatura **hiç kesilemiyordu**. Sabit tolerans
 *    satır sayısından habersiz olduğu için kapı yanlış yerdeydi.
 * 2. **Kesilmiş fatura okunamıyordu.** Aynı doğrulama okuma yolunda da çalışıyor
 *    (`taxSpecificationOf` → fatura listesi + detay uçları). Toleransı aşan bir
 *    satır veritabanında bir kez oluştuğunda fatura **kalıcı olarak** 422 veriyor:
 *    görüntülenemiyor, iptal edilemiyor, düzeltilemiyor.
 *
 * Bu yüzden rehidrasyon artık `fromTrusted` ile yapılır: saklanmış satır okuma
 * anında yeniden yargılanmaz (projedeki `fromTrusted` ↔ `create` sözleşmesinin
 * aynısı). Yazma kapısı `fromLineTotals`'ta ve payı **satır sayısından türetiyor**:
 * her satırın yuvarlaması en çok yarım kuruş kayar, yani toplam sapmanın üst sınırı
 * tam olarak `lineCount × 0,005`'tir. Kapı böylece kullanım yeriyle aynı genişlikte
 * olur (CLAUDE.md finans kuralı 12) — ne gerçek bir hatayı geçirir ne meşru
 * yuvarlamayı reddeder.
 */
export class TaxSpecification {
  /** Satır-başı yuvarlamanın tek satırda üretebileceği en büyük sapma (yarım kuruş). */
  private static readonly MAX_LINE_ROUNDING_DRIFT = new Decimal('0.005');

  private static readonly rateSchema = z
    .number()
    .min(0)
    .max(100, 'Vergi oranı 0-100 arasında olmalıdır.');

  private static readonly moneySchema = z.custom<Money>(
    (val) => val instanceof Money,
    { message: 'Geçersiz para nesnesi.' }
  );

  private readonly _netAmount: Money;
  private readonly _taxRate: number;
  private readonly _taxAmount: Money;

  private constructor(netAmount: Money, taxRate: number, taxAmount: Money) {
    this._netAmount = netAmount;
    this._taxRate = taxRate;
    this._taxAmount = taxAmount;
  }

  public get netAmount(): Money {
    return this._netAmount;
  }
  public get taxRate(): number {
    return this._taxRate;
  }
  public get taxAmount(): Money {
    return this._taxAmount;
  }
  public get grossAmount(): Money {
    return this._netAmount.add(this._taxAmount);
  }

  /**
   * Vergiyi **matrahtan ve orandan** hesaplar ve **kuruşa yuvarlar**.
   *
   * Yuvarlama zorunlu: tutarlar `Decimal(x,2)` kolonlara yazılıyor. Yuvarlanmamış
   * bir vergi (ör. 333,33 @ %20 → 66,666) veritabanına giderken sessizce
   * yuvarlanır; o andan sonra entity'nin hesapladığı brüt (399,996) ile saklanan
   * brüt (400,00) ayrışır ve fark hiçbir yerde görünmez.
   */
  public static create(netAmount: Money, taxRate: number): TaxSpecification {
    this.assertInput(netAmount, taxRate);

    const taxValue = netAmount.value
      .mul(taxRate)
      .div(100)
      .toDecimalPlaces(Money.PRECISION, Decimal.ROUND_HALF_UP);

    return new TaxSpecification(
      netAmount,
      taxRate,
      Money.create(taxValue, netAmount.currency).orThrow()
    );
  }

  /**
   * Vergiyi **satır toplamından** alır; otorite satırlardır.
   *
   * Kabul edilen sapma satır sayısından türer (`lineCount × 0,005`): KDV satır
   * bazında yuvarlandığı için toplam, orandan hesaplanan tutardan bu kadar
   * kayabilir — bu meşrudur. Payı aşan bir fark ise yuvarlama değil **hesap
   * hatasıdır** (yanlış oran, karışmış para birimi, eksik satır) ve faturanın
   * kesilmesini durdurmalıdır.
   */
  public static fromLineTotals(
    props: TaxSpecificationFromLineTotalsProps
  ): TaxSpecification {
    const { netAmount, taxRate, taxAmount, lineCount } = props;

    this.assertInput(netAmount, taxRate);
    this.moneySchema.parse(taxAmount);

    if (!Number.isInteger(lineCount) || lineCount < 1) {
      throw new InvalidTaxSpecificationException(
        `Satır sayısı en az 1 olmalıdır (gelen: ${lineCount}).`
      );
    }

    const expected = netAmount.value.mul(taxRate).div(100);
    const drift = taxAmount.value.minus(expected).abs();
    const allowed = this.MAX_LINE_ROUNDING_DRIFT.mul(lineCount);

    if (drift.gt(allowed)) {
      throw new InvalidTaxSpecificationException(
        `Satır KDV toplamı (${taxAmount.value.toFixed(2)}) orandan hesaplanan ` +
          `tutardan (${expected.toFixed(2)}) ${drift.toFixed(
            2
          )} sapıyor; ${lineCount} satır için izin verilen pay ` +
          `${allowed.toFixed(2)}.`
      );
    }

    return new TaxSpecification(netAmount, taxRate, taxAmount);
  }

  /**
   * Saklanmış kırılımı **doğrulamadan** kurar (rehidrasyon).
   *
   * Okuma yolunda çapraz kontrol yapılmaz: satır zaten yazma kapısından geçmiştir
   * ve orada yeniden yargılanmak, veritabanındaki bir kuruşluk sapmayı faturayı
   * **görüntülenemez** hâle getiren bir 422'ye çevirir. Saklanan değerler neyse
   * rapor da onu göstermelidir — sapma varsa onu mutabakat raporu bulur, okuma
   * ucu değil.
   */
  public static fromTrusted(
    netAmount: Money,
    taxRate: number,
    taxAmount: Money
  ): TaxSpecification {
    return new TaxSpecification(netAmount, taxRate, taxAmount);
  }

  /**
   * Brüt tutarı orana göre matrah + vergiye ayırır. Vergi, brütten yuvarlanmış
   * matrahın **düşülmesiyle** bulunur: böylece `matrah + vergi = brüt` birebir
   * tutar (ayrı ayrı yuvarlamak bir kuruş kaydırırdı).
   */
  public static fromGrossAmount(
    grossAmount: Money,
    vatRate: number
  ): TaxSpecification {
    const rateResult = this.rateSchema.safeParse(vatRate);
    if (!rateResult.success) {
      throw new InvalidTaxSpecificationException(
        rateResult.error.issues[0].message
      );
    }

    const divisor = new Decimal(1).plus(new Decimal(vatRate).div(100));
    const netValue = grossAmount.value
      .div(divisor)
      .toDecimalPlaces(Money.PRECISION, Decimal.ROUND_HALF_UP);
    const vatValue = grossAmount.value.minus(netValue);

    return new TaxSpecification(
      Money.create(netValue, grossAmount.currency).orThrow(),
      vatRate,
      Money.create(vatValue, grossAmount.currency).orThrow()
    );
  }

  private static assertInput(netAmount: Money, taxRate: number): void {
    const result = z
      .object({ netAmount: this.moneySchema, taxRate: this.rateSchema })
      .safeParse({ netAmount, taxRate });

    if (!result.success) {
      throw new InvalidTaxSpecificationException(
        result.error.issues[0].message
      );
    }
  }
}
