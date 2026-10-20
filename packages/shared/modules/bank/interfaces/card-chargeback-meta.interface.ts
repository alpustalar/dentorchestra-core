/**
 * Kart itirazı hatalarının `meta` sözleşmesi — backend exception'ları ve
 * frontend aynı tipi buradan import eder (iki-uçlu tip güvenliği).
 *
 * Tutarlar `Decimal` değil **string** taşınır (kuruş ölçeğinde, ör. "1250.00"):
 * JSON'da kayan nokta kuruş kaydırır.
 */

/** Aynı sağlayıcı vakası zaten kayıtlı (idempotency kısıtı). */
export interface ChargebackAlreadyRecordedMeta {
  provider: string;
  caseReference: string;
}

/** Çözümlenmiş itiraz tekrar çözümlenemez. */
export interface ChargebackAlreadyResolvedMeta {
  chargebackId: string;
  status: string;
}

/**
 * Tahsilat deftere yazılmamış: itiraz, defterde olmayan bir tahsilatı geri
 * alamaz. Genellikle muhasebe köprüsü başarısız olmuştur — POS için
 * `POST /pos/transactions/backfill-accounting` ile telafi edilir.
 */
export interface ChargebackSourceNotInLedgerMeta {
  sourceType: string;
  sourceId: string;
}

/**
 * Yeni itiraz geri götürülebilir tutarı aştı (tahsilat − iade/iptal − aktif
 * itirazlar). `available` yeni itirazın alabileceği en fazla tutardır.
 */
export interface ChargebackExceedsReversibleMeta {
  /** Geri götürülebilir tutar: tahsilat − iade/iptal (itirazlar HARİÇ). */
  reversible: string;
  /** Açık ya da kaybedilmiş itirazların toplamı. */
  activeChargebacks: string;
  /** Kaydedilmek istenen itiraz tutarı. */
  requested: string;
  /** Yeni itirazın alabileceği en fazla tutar: reversible − activeChargebacks. */
  available: string;
}

/**
 * İade/iptal, kart itirazı altındaki bir tahsilatı aşıyor (tahsilat ≥ iade/iptal
 * + aktif itirazlar + istenen olmak zorunda). Para geri götüren her yol (iade,
 * iptal, ters ibraz) aynı kümülatif tavanı paylaşır.
 */
export interface ChargebackCollectionCapMeta {
  /** Kartla tahsil edilen tutar. */
  collected: string;
  /** Daha önce iade/iptal edilen (canlı) tutar. */
  alreadyReversed: string;
  /** Açık ya da kaybedilmiş itirazların toplamı. */
  activeChargebacks: string;
  /** Şimdi geri götürülmek istenen tutar. */
  requested: string;
}
