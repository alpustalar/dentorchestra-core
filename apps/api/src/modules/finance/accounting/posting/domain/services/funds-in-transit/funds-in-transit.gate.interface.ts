import { Decimal } from 'decimal.js';

export const FUNDS_IN_TRANSIT_GATE = Symbol('IFundsInTransitGate');

export interface AssertCanSettleParams {
  clinicId: string;
  /** 108'den düşülecek brüt tutar (net + komisyon). */
  grossAmount: Decimal;
}

/**
 * "Yolda olan para" (108 Diğer Hazır Değerler) kapısı.
 *
 * Kartla tahsil edilen para sağlayıcıda bekler ve defterde 108'de durur; hesap
 * kapaması o bakiyeyi azaltır (`B 102 + B 653 / A 108`). Kapanabilecek tutar
 * **bakiyeden fazla olamaz**: olursa 108 alacak bakiyesine (eksiye) düşer ki bu
 * bir hazır değer hesabı için imkânsızdır, ve 102'ye hiç gelmemiş para girer.
 * Hata sessizdir — fiş kendi içinde dengeli olduğu için Σborç = Σalacak tutar.
 *
 * §81'deki kasa çekmecesi kapısının defterdeki karşılığı: **bakiye kontrolü
 * kaydın önüne konur**, kapanış hesabına değil.
 *
 * Neden domain servisi (bus değil): veri döndürmez, çağıranın yazmasını kapıda
 * durdurur; okuma Command Repo'dan ve **kilit altında** yapılır (CLAUDE.md
 * senkron invariant kontrolü + `lockAndGet*` kuralı). Yetki kontrolü çağıranın
 * işidir.
 */
export interface IFundsInTransitGate {
  assertCanSettle(params: AssertCanSettleParams): Promise<void>;
}
