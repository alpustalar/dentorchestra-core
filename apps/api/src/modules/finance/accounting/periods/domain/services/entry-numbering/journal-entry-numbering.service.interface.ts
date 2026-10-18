export const JOURNAL_ENTRY_NUMBERING_SERVICE = Symbol(
  'IJournalEntryNumberingService'
);

/**
 * Yevmiye numarası tahsisi — dönem modülünün posting'e açtığı dar sözleşme.
 *
 * Neden domain servisi (bus değil): dönüş **tek bir skaler** (sıra numarası) ve
 * çağrı, kilidi alan işlemle **aynı metotta** yapılıyor — CLAUDE.md'deki
 * "kilitli skaler okuma" (`lockAndGet*`) istisnası. Numarayı almak ile kilidi
 * almak ayrı çağrılara bölünemez: bölünürse sıra bozulur ya da kilit atlanır ve
 * bu, derleyicinin göremediği bir mükerrer-numara hatasına dönüşür.
 *
 * Numara tahsisi aynı zamanda **dönem kapısıdır**: satır kilidi eşzamanlı dönem
 * kapanışını bekletir, kapanış önce commit olduysa tahsis reddedilir.
 */
export interface IJournalEntryNumberingService {
  /**
   * Açık dönem için sıradaki yevmiye numarası. Dönem OPEN değilse
   * `PeriodNotOpenException` fırlatır.
   *
   * ⚠️ Fişin yazıldığı transaction **içinden** çağrılmalıdır; tx dışında
   * çağrılırsa numara ayrı commit edilir (boşluk) ve kilit anında serbest kalır —
   * repository bunu sesli hata ile reddeder.
   */
  lockAndAllocateEntryNo(periodId: string): Promise<bigint>;

  /**
   * Yıl sonu kapanış fişleri için numara; dönem durumu kontrol **edilmez**.
   * Yalnız dönemi aynı transaction içinde CLOSED'a çekmiş (ve satır kilidini
   * tutan) kapanış akışı çağırır.
   */
  lockAndAllocateClosingEntryNo(periodId: string): Promise<bigint>;
}
