import { AppointmentChargeTotals } from '@modules/finance/treatment-charge/domain/value-objects/appointment-charge-totals.vo';

export const CHARGE_TOTALS_SERVICE = Symbol('IChargeTotalsService');

/**
 * Fatura/tahsilat tutarının **kilitli** kaynağı.
 *
 * Neden domain servisi, neden QueryBus değil: tutar bir **yazma kararını**
 * besliyor. Daha önce fatura kesimi `GetAppointmentChargeSummaryQuery` ile
 * (Query Repo, kilitsiz, read-replica'ya yönlenebilir) okuyup tutarı **ayrı
 * bir transaction'da** yazıyordu. Okuma ile yazma arasındaki pencerede bir
 * satır iptal edilebiliyor ya da indirimi değişebiliyordu; fatura o zaman
 * kendi satırlarıyla uyuşmayan bir tutarla kesiliyor ve `assertAppointmentNotInvoiced`
 * artık düzeltmeyi de engellediği için fark **kalıcı** kalıyordu (düzeltmenin
 * tek yolu fatura iptali).
 *
 * `lockAndGet*` adı kilidi görünür kılar: satırlar `FOR UPDATE` ile kilitlenir
 * ve toplam aynı metotta, aynı transaction içinde döner (kilit ile okumayı
 * ayrı metotlara bölmek, sırayı bozmayı derleyicinin göremediği bir hata
 * hâline getirirdi).
 */
export interface IChargeTotalsService {
  /**
   * Randevunun iptal edilmemiş satırlarını kilitler ve toplamı döner.
   * Satır yoksa `null` (serbest tutarlı fatura/tahsilat meşrudur).
   *
   * **Yalnız aktif transaction içinde** çağrılır.
   */
  lockAndGetAppointmentTotals(
    appointmentId: string
  ): Promise<AppointmentChargeTotals | null>;
}
