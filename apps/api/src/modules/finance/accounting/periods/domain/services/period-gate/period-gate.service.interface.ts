export const PERIOD_GATE_SERVICE = Symbol('IPeriodGateService');

export interface AssertPeriodNotSealedParams {
  clinicId: string;
  /** Belgenin/işlemin kendi tarihi — `now` değil, kullanıcının verdiği tarih. */
  date: Date;
}

/**
 * Belge tarihinin mühürlenmiş (LOCKED/CLOSED) bir döneme düşmesini **yazma
 * kapısında** durduran domain servisi.
 *
 * Neden domain servisi (bus değil): veri döndürmez, çağıranın yazmasını kapıda
 * durdurur — CLAUDE.md'deki senkron invariant kontrolü satırı. Okuma Command
 * Repo'dan yapılır (yazma kararını besliyor).
 *
 * **Neden "mühürlü mü" diye soruyor, "açık mı" diye değil:** posting'in kapısı
 * dönemin hem var hem OPEN olmasını ister. Bu kapı daha dardır ve bilinçli
 * olarak dönemi **olmayan** kliniği geçirir: muhasebesi hiç kurulmamış bir
 * şubede (hiç dönem satırı yok) belge kaydını reddetmek, muhasebeyle ilgisi
 * olmayan operasyonu — alış faturası girişi, satıcı ödemesi, bordro — komple
 * durdururdu. O boşluk zaten görünür: `sweep-unposted-financial-events`
 * fişlenemeyen olayı CRITICAL uyarı + mutabakat listesiyle gösteriyor. Buradaki
 * kapının işi, **kullanıcının düzeltebileceği** tek hatayı — tarihi mühürlenmiş
 * döneme düşürmeyi — anında söylemek.
 *
 * Yetki kontrolü çağıran handler'ın işidir; servis yetki değerlendirmez.
 */
export interface IPeriodGateService {
  assertPeriodNotSealedAt(params: AssertPeriodNotSealedParams): Promise<void>;
}
