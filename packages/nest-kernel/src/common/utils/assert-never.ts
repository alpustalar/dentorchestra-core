/**
 * Ayrık birleşim (discriminated union) üzerindeki `switch`'lerin tam olduğunu
 * DERLEME ZAMANINDA zorlar.
 *
 * Neden gerekli: birleşime yeni bir üye eklendiğinde `if/else` veya `default`'suz
 * `switch` sessizce yanlış dala düşer ve TypeScript uyarmaz. `default` dalında bu
 * fonksiyon çağrıldığında, kapsanmayan her yeni üye `never`'a atanamadığı için
 * derleme hatası verir.
 *
 * @example
 * switch (intent.type) {
 *   case 'HOTEL': return bookHotel(intent);
 *   case 'TRANSFER': return bookTransfer(intent);
 *   default: return assertNever(intent, `Bilinmeyen rezervasyon türü`);
 * }
 */
export function assertNever(value: never, message?: string): never {
  throw new Error(
    message ?? `Beklenmeyen değer: ${JSON.stringify(value)}`
  );
}
