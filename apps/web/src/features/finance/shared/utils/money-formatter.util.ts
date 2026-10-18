const DEFAULT_CURRENCY = 'TRY';

/**
 * Para tutarları sunucudan **string** gelir (`Decimal` → JSON string). Bu
 * biçimlendirici de string alır ve `Number()`a çevirmez:
 * `Intl.NumberFormat.prototype.format` ES2023'ten beri string kabul edip ondalığı
 * tam biçimlendiriyor. Sayıya çevirmek kuruş hassasiyetini kaybettirebilir ve
 * kaybı sessiz olur — yuvarlanmış bir tutar da geçerli bir tutar gibi görünür.
 * (Eski motorlarda çağrı örtük sayıya çevirmeye düşer; bozulmaz, yalnız eski
 * davranışa döner.)
 */
export function formatMoney(
  value: string | undefined,
  currency: string | undefined = DEFAULT_CURRENCY
): string | undefined {
  if (value === undefined) return undefined;

  const formatter = new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: currency || DEFAULT_CURRENCY,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return (formatter.format as (input: string) => string)(value);
}

/**
 * `amount` bazı uçlarda `number` (FinanceLedger DTO'su `@Type(() => Number)`
 * kullanıyor), bazılarında string. Tek bir gösterim yolu olsun diye ikisini de
 * yutar.
 */
export function formatAmount(
  value: string | number | undefined,
  currency?: string
): string | undefined {
  if (value === undefined) return undefined;
  return formatMoney(String(value), currency);
}
