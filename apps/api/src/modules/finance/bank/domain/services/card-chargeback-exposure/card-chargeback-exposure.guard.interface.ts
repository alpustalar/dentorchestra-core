import { Decimal } from 'decimal.js';
import type { CardChargebackSourceType } from '@input-type-schemas/CardChargebackSourceSchema';

export const CARD_CHARGEBACK_EXPOSURE_GUARD = Symbol(
  'ICardChargebackExposureGuard'
);

export interface AssertReversalWithinCollectionParams {
  sourceType: CardChargebackSourceType;
  /** POS_TRANSACTION → POS işlem id'si; ONLINE_PAYMENT → taksit id'si. */
  sourceId: string;
  /** Kartla tahsil edilen toplam tutar (satış / taksit tutarı). */
  collectedAmount: Decimal;
  /** Daha önce iade/iptal edilen (canlı) tutar. */
  alreadyReversedAmount: Decimal;
  /** Şimdi geri götürülmek istenen tutar. */
  requestedAmount: Decimal;
}

/**
 * Parayı kart sahibine geri götüren **iade / iptal** yollarının, kart itirazını
 * da hesaba katan kümülatif tavan kapısı.
 *
 * Kart sahibine parayı geri götüren üç yol vardır: iade, iptal ve ters ibraz
 * (kart itirazı). Üçü de aynı satışın aynı tutarına dokunur; her yolun tavanı
 * diğerlerini bilmiyorsa para **iki kez** geri gider (bir kez sağlayıcı kesintisi,
 * bir kez bizim iademiz). İade/iptal handler'ları kendi tavanlarını (iade ≤
 * satış) zaten kontrol eder; bu kapı o kontrole **itiraz boyutunu** ekler:
 *
 *   iade/iptal + aktif itirazlar + istenen ≤ tahsilat
 *
 * Aktif itiraz = açık (OPEN) + kaybedilmiş (LOST). Kazanılan itirazın parası geri
 * geldiği için düşülmez.
 *
 * Neden domain servisi (bus değil): veri döndürmez, çağıranın yazmasını kapıda
 * durdurur (CLAUDE.md senkron invariant kontrolü — `assert*`). Okuma Command
 * Repo'dandır: bu bir para hareketine karar veriyor, replica gecikmesiyle "itiraz
 * yok" görmek iadeyi geçirirdi. Sahip modülün yaprak domain-servis modülünde
 * sağlanır (`BankDomainServicesModule`).
 */
export interface ICardChargebackExposureGuard {
  assertReversalWithinCollection(
    params: AssertReversalWithinCollectionParams
  ): Promise<void>;
}
