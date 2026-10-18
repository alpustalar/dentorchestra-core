/**
 * Yürürlükteki yasal KDV oranları (TR, 2026): %0, %1, %10, %20.
 *
 * **Tek kaynak — `packages/shared`'te durmak zorunda.** Aynı küme üç yerde
 * zorlanıyor ve ikisinin ayrışması sessiz bir arızaydı:
 *  - HTTP yazma kapıları (`SetTaxParameterSchema`, `AddTreatmentChargeSchema`)
 *  - `TaxParameter` entity'si (parametre tablosuna yazma)
 *  - `VatRate` VO (oranın fiilen kullanıldığı yer: fatura, işlem satırı)
 *
 * Kapı daha genişken (0–100) kullanıcı yasal olmayan bir oran (ör. %8)
 * gönderebiliyordu; istek kapıdan geçiyor, sonra entity/VO onu reddediyordu —
 * yani hata sebebinden kopuk bir yerde "Yasal olmayan KDV oranı" diyerek
 * faturalamayı durduruyordu.
 *
 * Mevzuat değişirse (ör. %20 → %22) yalnız burası güncellenir; tüm zincir uyar.
 */
export const STATUTORY_VAT_RATES: readonly number[] = [0, 1, 10, 20];

/**
 * KDV dışı vergi oranlarının (stopaj, kurumlar vergisi) sınırı: oran yüzde
 * olarak 0–100 arasında ve en çok 2 ondalık basamaklı olmalı. Sabit bir yasal
 * küme yoktur (stopaj %20, kurumlar %25, gelecekte başka bir değer olabilir);
 * ondalık sınırı DB kolonundan gelir (`Decimal(5,2)`).
 */
export const TAX_RATE_MAX_DECIMAL_PLACES = 2;

/** KDV anahtarları yasal orana bağlıdır; stopaj/kurumlar için sabit küme yoktur. */
export const isVatTaxParameterKey = (key: string): boolean =>
  key.startsWith('VAT_');
