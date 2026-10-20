export const FINANCIAL_EVENT_PRESENCE_GUARD = Symbol(
  'IFinancialEventPresenceGuard'
);

export interface AssertEventRecordedParams {
  clinicId: string;
  /** Olayın idempotency anahtarı (`FinancialEventDedupeKeys.*`). */
  dedupeKey: string;
}

/**
 * Bir ekonomik olayın olay defterinde **yazılmış** olduğunu kanıtlar.
 *
 * Başka bir kaydı o olaya dayandırmadan önce çağrılır (kart itirazı: itiraz
 * edilen tahsilatın `PAYMENT_RECEIVED` olayı). Olay yoksa dayanılan şey deftere
 * hiç ulaşmamıştır ve ters kayıt olmayan parayı düşer.
 *
 * Neden domain servisi (bus değil): veri döndürmez, çağıranın yazmasını kapıda
 * durdurur (CLAUDE.md senkron invariant kontrolü). Okuma Command Repo'dan yapılır:
 * bu bir yazma kararını besliyor ve replica gecikmesiyle "olay yok" görmek geçerli
 * bir itirazı reddettirirdi. `dedupeKey` global tekildir ama kiracı doğrulanır:
 * başka bir kliniğin olayı bu kliniğin kanıtı sayılamaz.
 */
export interface IFinancialEventPresenceGuard {
  /**
   * @param error Olay yoksa fırlatılacak hata; verilmezse
   *   `FinancialEventNotRecordedException`. Çağıran kendi bağlamının hatasını
   *   (ör. `ChargebackSourceNotInLedgerException`) geçebilir.
   */
  assertRecorded(
    params: AssertEventRecordedParams,
    error?: Error
  ): Promise<void>;

  /**
   * Olay yazılmış mı? Salt-okur sorgu: `assertRecorded`'ın tersi kullanım için ("bu olay ZATEN
   * yazılıysa şu kararı verme"). Aynı kiracı kuralı geçerli: başka kliniğin olayı "yok" sayılır.
   */
  isRecorded(params: AssertEventRecordedParams): Promise<boolean>;
}
