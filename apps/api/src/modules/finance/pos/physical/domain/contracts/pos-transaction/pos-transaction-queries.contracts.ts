import { Decimal } from 'decimal.js';
import { PosTransactionKindType } from '@input-type-schemas/PosTransactionKindSchema';
import { PosTransactionStatusType } from '@input-type-schemas/PosTransactionStatusSchema';
import { PosProviderType } from '@input-type-schemas/PosProviderSchema';

/**
 * PosTransaction domain kontratları — okuma modelleri.
 *
 * Çoğu okuma **Command Context**'tir (mutabakat taraması, iptal/iade özeti):
 * okunan durum doğrudan bir para hareketine karar verir. İki okuma ise salt
 * operasyonel rapordur ve Query repository'ye aittir: takılı kalmış PENDING
 * işlemler ve muhasebe köprüsü kurulamamış tahsilatlar (telafi listesi).
 */

/** PAX cihazına TCP bağlanmak için mutabakat taraması sırasında taşınan bağlantı anlık görüntüsü. */
export interface PendingTransactionDeviceSnapshot {
  host: string;
  port: number;
  terminalId: string;
  merchantId: string;
}

/** Grace period dışında kalan PENDING işlem — mutabakat taraması read-model'i. */
export interface PendingTransactionForReconcile {
  id: string;
  posDeviceId: string;
  clinicId: string;
  amount: Decimal;
  currency: string;
  initiatedAt: Date;
  device: PendingTransactionDeviceSnapshot;
}

/**
 * Bir POS işleminin **değişmeyen olguları** — başka modüllerin (kart itirazı)
 * kaydı bağlayacağı kimlikler ve niteleyiciler.
 *
 * Yalnız SUCCESS bir satışta değişmeyen alanlar taşır (hasta, ödeme planı,
 * sağlayıcı, para birimi, tutar). Bir para kararını **besleyen değişken** durum
 * (canlı iadeler, iptal) bilerek burada YOKTUR: o okuma Command Repo'dan,
 * satır kilidi altında yapılır (`POS_CARD_COLLECTION_SERVICE`).
 */
export interface PosTransactionSummary {
  id: string;
  clinicId: string;
  kind: PosTransactionKindType;
  status: PosTransactionStatusType;
  /** Cihazın sağlayıcısı — itirazın sağlayıcısı bundan türer. */
  provider: PosProviderType;
  /** Hastasız kart çekimi deftere hiç köprülenmez; bu yüzden null olabilir. */
  patientId: string | null;
  /** Bağlı ödeme planı; null ise tahsilat bir plana yazılmamıştır. */
  paymentId: string | null;
  amount: Decimal;
  currency: string;
  completedAt: Date | null;
}

/**
 * Bir satışın CANLI (PENDING/SUCCESS) ters kayıtlarının özeti. İptal/iade kararını
 * besler: iptal en fazla bir kez yapılabilir, iadeler kümülatif olarak satışı aşamaz.
 * Command Context'e aittir — orijinal satır `FOR UPDATE` kilitliyken okunur.
 */
export interface PosTransactionReversalSummary {
  hasActiveVoid: boolean;
  refundedAmount: Decimal;
}

// ==========================================
// OPERASYONEL RAPORLAR (Query Context)
// ==========================================

/**
 * Takılı kalmış PENDING işlem — kart çekilmiş olabilir ama sonucu hiç
 * doğrulanmamıştır. PAX dışı sağlayıcılarda (iyzico Terminal) durum sorgusu
 * API'si olmadığı için bu liste **tek** görünürlük yoludur.
 */
export interface StalePosTransactionRow {
  id: string;
  clinicId: string;
  posDeviceId: string;
  provider: string;
  amount: Decimal;
  currency: string;
  kind: string;
  paymentId: string | null;
  initiatedAt: Date;
}

export interface FindStalePosTransactionsFilter {
  clinicId: string;
  /** Bu süreden eski PENDING işlemler (dakika). */
  olderThanMinutes: number;
}

/**
 * Klinik kapsamı olmayan tarama — zamanlanmış mutabakat işi bütün kliniklerde
 * askıda kalmış işlem arar. `excludeProviders` ile cihaza sorulabilen
 * sağlayıcılar (PAX) hariç tutulur: onlar zaten döngüde sonuçlandırılır.
 */
export interface ScanStalePosTransactionsParams {
  olderThanMinutes: number;
  excludeProviders: string[];
}

/**
 * Muhasebe köprüsü adayı: başarılı, hastaya bağlı SATIŞ işlemi. Ekonomik olayın
 * yazılıp yazılmadığını bu modül BİLMEZ (bounded context) — eşleştirme
 * `financial-events` tarafından gelen referans listesiyle yapılır.
 */
/**
 * Köprülenebilir POS hareketi — satış **ve ters kayıt** (iptal/iade).
 *
 * Eskiden yalnız satışları taşıyordu (`SuccessfulPosSaleRow`) ve tarama da
 * `kind: SALE` ile süzüyordu: ters kayıtların muhasebe köprüsü best-effort
 * olduğu halde eksik kalanı **listelenemiyor, telafi edilemiyordu** (CLAUDE.md
 * finans kuralı 4 — yutulan kritik iş için "eksik kalanlar" sorgusu + backfill
 * komutu bulunmak zorundadır).
 */
export interface BridgeablePosTransactionRow {
  id: string;
  clinicId: string;
  patientId: string;
  amount: Decimal;
  currency: string;
  completedAt: Date | null;
  kind: PosTransactionKindType;
  /** Ters kayıtta geri alınan satış; satışlarda null. */
  originalPosTransactionId: string | null;
}

export interface FindBridgeablePosTransactionsFilter {
  clinicId: string;
  from: Date;
  to: Date;
}
