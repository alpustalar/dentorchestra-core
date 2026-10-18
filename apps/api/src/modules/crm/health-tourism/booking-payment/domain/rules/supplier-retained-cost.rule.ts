import { Money } from '@src/domain/value-objects/money.vo';
import { Currency } from '@src/domain/value-objects/currency.vo';
import { SupplierRetainedCost } from '@modules/crm/health-tourism/booking-payment/domain/contracts/booking-payment';

/**
 * Sağlayıcının bildirdiği iptal cezasını domain şekline çevirir.
 *
 * Tek bir kuralı zorlar: **"bilinmiyor" ile "sıfır" aynı şey değildir.** Tutar
 * gelmediyse, sayı değilse, negatifse ya da para birimi tanınmıyorsa sonuç
 * `null`'dır — `0` döndürmek defterde "sağlayıcı ceza almadı, tedarikçi borcunun
 * tamamı serbest kaldı" beyanı olurdu ve bu beyanın dayanağı yok.
 *
 * Çevrim üç sağlayıcının **üçünde de** aynı yerden geçsin diye burada: her
 * adapter kendi `?? 0`'ını yazarsa kural üç kopyaya dağılır ve biri sapar.
 */
export const toSupplierRetainedCost = (
  amount: number | string | null | undefined,
  currency: string | null | undefined
): SupplierRetainedCost | null => {
  if (amount === null || amount === undefined) return null;
  if (!currency) return null;

  const parsedCurrency = Currency.create(currency).instance;
  if (!parsedCurrency) return null;

  // `Money.create` sayısal geçerliliği zorlar ve negatifi reddeder; sıfırı ise
  // kabul eder — "ücretsiz iptal" meşru bir cevaptır.
  const money = Money.create(amount, parsedCurrency.value).instance;
  if (!money) return null;

  return { amount: money.toApiFormat(), currency: parsedCurrency.value };
};
