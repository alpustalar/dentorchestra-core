import { StockMovement, Pagination } from '@shared';
import { Decimal } from 'decimal.js';

/** Filter for finding stock movements. */
export interface FindStockMovementFilter {
  productId?: string;
  clinicId: string;
  batchId?: string;
  type?: string;
  direction?: string;
  startDate?: Date;
  endDate?: Date;
}

/** Stock movement read-model for query responses. */
export type StockMovementResponse = StockMovement;

/** Paginated movement results. */
export interface StockMovementPage {
  items: StockMovementResponse[];
  total: number;
  pagination: Pagination;
}

/** Current stock level snapshot. */
export interface StockLevel {
  productId: string;
  productName: string;
  stockCode: string;
  clinicId: string;
  totalQuantity: Decimal | string;
  criticalStockQty: Decimal | string;
  isBelowCritical: boolean;
}

/**
 * Envanter değerlemesi — ürün × para birimi kırılımında eldeki stoğun **fiili
 * maliyeti**.
 *
 * Değerleme politikası: **parti bazlı fiili maliyet** (specific identification).
 * Sistem bunu zaten fiilen uyguluyor — tüketim FEFO sırasıyla belirli bir
 * partiden düşüyor ve hareket o partinin alış fiyatıyla değerleniyor — bu yüzden
 * ağırlıklı ortalama ya da FIFO katmanı eklemek defterle ayrışma üretirdi.
 *
 * Para birimi **çevrilmez**: parti kendi para biriminde değerlenir. Yabancı para
 * partisinin fonksiyonel (TRY) maliyeti mal kabul anındaki kura bağlıdır ve o kur
 * bugün hiçbir yerde saklanmıyor (bkz. denetim dokümanı §46); rapor-anı kuruyla
 * çevirmek tarihi maliyeti bozar. Bu yüzden satır para birimini taşır, toplam
 * para birimi başına verilir.
 */
export interface InventoryValuationLine {
  productId: string;
  productName: string;
  stockCode: string;
  currency: string;
  /** Eldeki miktar (parti toplamı). */
  quantity: string;
  /** Eldeki stoğun maliyeti = Σ(parti miktarı × parti alış fiyatı). */
  value: string;
  /**
   * Ürün silinmiş (soft-delete) ama stoğu duruyor. Stok listeleri silinmiş
   * ürünleri süzdüğü için bu değer **hiçbir ekranda görünmez** — değerlemede
   * bilerek gösterilir, 150 bakiyesindeki farkın en olası sebebidir.
   */
  isProductDeleted: boolean;
}

/** Para birimi başına envanter değeri toplamı. */
export interface InventoryValuationCurrencyTotal {
  currency: string;
  value: string;
}

export interface InventoryValuationReport {
  clinicId: string;
  asOf: Date;
  lines: InventoryValuationLine[];
  totals: InventoryValuationCurrencyTotal[];
  /** Fonksiyonel para (TRY) cinsinden toplam — mutabakatın karşılaştırdığı değer. */
  functionalTotal: string;
  /** TRY dışı parti var mı? Varsa 150 mutabakatı kısmidir. */
  hasForeignCurrencyStock: boolean;
}

/**
 * Envanter ↔ defter (150) mutabakatı.
 *
 * Fark **kendiliğinden hata değildir**: stok ile defteri ayıran meşru kalemler
 * var (mal gelmiş faturası gelmemiş, fatura stok yerine gidere kaydedilmiş gibi).
 * Rapor bu yüzden otomatik düzeltme yapmaz; farkı ve bilinen sebeplerini
 * gösterir (CLAUDE.md finans kuralı 11 — şablondan/türetilmiş veride sapma
 * raporu zorunlu, otomatik onarım değil).
 */
export interface InventoryLedgerReconciliation {
  clinicId: string;
  asOf: Date;
  /** Envanter tarafı: fonksiyonel para cinsinden eldeki stok maliyeti. */
  inventoryValue: string;
  /** Defter tarafı: 150 hesabının borç bakiyesi. */
  ledgerStockBalance: string;
  /** envanter − defter (pozitif: stok defterden fazla). */
  difference: string;
  isReconciled: boolean;
  /** Çevrilmediği için karşılaştırmaya girmeyen yabancı para stok değerleri. */
  foreignCurrencyTotals: InventoryValuationCurrencyTotal[];
  /** Stoğu olup silinmiş ürünlerin değeri (farkın en olası sebebi). */
  deletedProductValue: string;
}

/**
 * Parti miktarı ↔ hareket toplamı sapması taşıyan tek parti.
 *
 * `product_batches.quantity` **türetilmiş** bir alandır: doğruluk kaynağı
 * `stock_movements` kayıtlarıdır (şemanın kendi notu: "denormalized running
 * total"). Türetilmiş veri için sapma raporu zorunludur (CLAUDE.md finans
 * kuralı 11) — çünkü envanter değerlemesi ve dolayısıyla 150 mutabakatı bu
 * alandan besleniyor: parti miktarı kayarsa fark, defter tarafında değil
 * **kaynakta** oluşur ve 150 mutabakatı sebebini gösteremez.
 *
 * Otomatik onarım YAPILMAZ: miktarı hareketlere eşitlemek eksik hareketi
 * uydurmak, hareketleri miktara eşitlemek ise fiilî stoğu yalanlamak olurdu.
 * Hangisinin doğru olduğu bir sayım kararıdır.
 */
export interface BatchQuantityDriftLine {
  batchId: string;
  productId: string;
  productName: string;
  stockCode: string;
  lotNumber: string | null;
  currency: string;
  /** Partide yazılı (denormalize) miktar. */
  batchQuantity: string;
  /** Hareketlerden türeyen miktar: Σ(giriş) − Σ(çıkış). */
  movementQuantity: string;
  /** parti − hareket (pozitif: partide hareketsiz miktar var). */
  quantityDrift: string;
  /** Sapmanın değerlemeye etkisi = sapma × parti alış fiyatı. */
  valueDrift: string;
  /**
   * Partinin son güncellenme anı. Saniyeler önceki bir sapma normal olabilir:
   * tüketim/düzeltme hareketini **dinleyici** yazar (outbox), yani parti
   * güncellendikten birkaç saniye sonra oluşur. Mal kabul hareketi ise aynı
   * transaction içinde yazılır — orada gecikme penceresi yoktur.
   */
  batchUpdatedAt: Date;
}

/** Para birimi başına sapmanın değer etkisi. */
export interface BatchQuantityDriftCurrencyTotal {
  currency: string;
  valueDrift: string;
  batchCount: number;
}

export interface BatchQuantityDriftReport {
  clinicId: string;
  asOf: Date;
  lines: BatchQuantityDriftLine[];
  totals: BatchQuantityDriftCurrencyTotal[];
  /** Sapması olan parti sayısı; 0 ise envanter değerlemesinin tabanı sağlam. */
  driftedBatchCount: number;
}
