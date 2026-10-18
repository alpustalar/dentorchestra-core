import { Decimal } from 'decimal.js';
import { CurrencyType } from '@input-type-schemas/CurrencySchema';
import { Money } from '@src/domain/value-objects/money.vo';

export interface FxConvertLineInput {
  debit?: string;
  credit?: string;
  txCurrency: CurrencyType; // işlemin orijinal para birimi
  functionalCurrency: CurrencyType; // defterin para birimi
  rate: Decimal | null; // orijinal→fonksiyonel kuru; null = çevirme yok
}

/** Fonksiyonel para cinsinden satır tutarı + (varsa) orijinal izlenebilirlik. */
export interface FxConvertedLine {
  debit?: string | Decimal;
  credit?: string | Decimal;
  currency: CurrencyType;
  originalDebit?: Decimal | null;
  originalCredit?: Decimal | null;
  originalCurrency?: CurrencyType | null;
  fxRate?: Decimal | null;
}

/** Yuvarlama artığını kapatacak denkleştirme satırı yönü + tutarı. */
export interface FxRoundingBalance {
  side: 'DEBIT' | 'CREDIT'; // DEBIT → 656 Kambiyo Zararı, CREDIT → 646 Kambiyo Kârı
  amount: Decimal; // pozitif
}

/**
 * Posting-time döviz çevrimi (saf domain — Model A). Bir yevmiye satırının
 * orijinal para birimindeki tutarını defterin fonksiyonel para birimine çevirir;
 * `debit`/`credit` daima fonksiyonel olur, orijinal tutar + kur saklanır.
 *
 * Çevirme gerekmiyorsa (kur yok ya da işlem zaten fonksiyonel parada) satır
 * olduğu gibi döner, `original*` alanları boş kalır.
 */
export class FxConversion {
  static convertLine(input: FxConvertLineInput): FxConvertedLine {
    const { debit, credit, txCurrency, functionalCurrency, rate } = input;

    if (!rate || txCurrency === functionalCurrency) {
      return { debit, credit, currency: functionalCurrency };
    }

    const origDebit = debit ? new Decimal(debit) : null;
    const origCredit = credit ? new Decimal(credit) : null;

    return {
      debit: Money.scale((origDebit ?? new Decimal(0)).mul(rate)),
      credit: Money.scale((origCredit ?? new Decimal(0)).mul(rate)),
      currency: functionalCurrency,
      originalDebit: origDebit,
      originalCredit: origCredit,
      originalCurrency: txCurrency,
      fxRate: rate,
    };
  }

  /**
   * Satır-başı yuvarlama sonrası oluşan borç/alacak dengesizliğini kapatacak
   * Kambiyo farkı satırının yönü ve tutarını döner. Denge zaten sağlanmışsa null.
   *
   * Borç fazlaysa alacak eklenir (646 Kambiyo Kârı); alacak fazlaysa borç
   * eklenir (656 Kambiyo Zararı).
   */
  static roundingBalance(
    totalDebit: Decimal,
    totalCredit: Decimal
  ): FxRoundingBalance | null {
    const diff = totalDebit.minus(totalCredit);
    if (diff.isZero()) return null;
    return diff.gt(0)
      ? { side: 'CREDIT', amount: diff }
      : { side: 'DEBIT', amount: diff.abs() };
  }
}
