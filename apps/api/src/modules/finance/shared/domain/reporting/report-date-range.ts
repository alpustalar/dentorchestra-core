import { DateTimeManager } from '@shared/common/utils/date-time/date-time.manager';

/** Rapor tarih aralığı — iki uç da opsiyonel (açık uçlu rapor tüm defteri kapsar). */
export interface ReportDateRange {
  dateFrom?: Date;
  dateTo?: Date;
}

/**
 * Rapor aralığını **gün sınırlarına** genişletir: `dateFrom` → günün ilk anı,
 * `dateTo` → günün son anı.
 *
 * Neden zorunlu: `entryDate` tam bir zaman damgasıdır (olayın `occurredAt`'i),
 * ama rapor isteği bir **gün** taşır (`?dateTo=2026-12-31` → 00:00:00). Ham
 * `lte: dateTo` kullanılırsa aralığın **son günü tamamen düşer** — yalnız tam
 * gece yarısına damgalanmış bir fiş sayılır. Etkisi tüm defter raporlarına
 * yayılıyordu: ayın son günü KDV beyanında görünmez (yasal bildirim eksik
 * çıkar), banka mutabakatı adayları arasında bulunmaz (ekstre satırı kalıcı
 * `UNMATCHED` kalır), mizan/kebir/yevmiye son günü atlar. Hata sessizdir:
 * düşen fişler kendi içinde dengeli olduğu için "Σborç = Σalacak" yine tutar.
 *
 * Konumu `finance/shared`: aynı normalizasyonu üç modül kullanıyor (muhasebe
 * raporları, cari defter özeti, hekim hasılatı). Saf bir tarih yardımcısıdır —
 * modüle ait bir iş kuralı taşımadığı için paylaşılması sınır ihlali değildir.
 *
 * Gün sınırı kliniğin saat diliminde hesaplanır (`DateTimeManager` varsayılanı
 * `Europe/Istanbul` — bkz. `documents/finans/README.md` varsayımları). Rapor
 * "31 Aralık" dediğinde kastedilen kliniğin takvim günüdür, UTC günü değil.
 *
 * Saflık: aynı girdi için aynı çıktı; `undefined` uç `undefined` kalır (Prisma
 * `gte: undefined`'ı kısıt saymaz → açık uçlu aralık korunur).
 */
export function normalizeReportDateRange(
  range: ReportDateRange
): ReportDateRange {
  return {
    dateFrom: range.dateFrom
      ? DateTimeManager.startOfDay(range.dateFrom)
      : undefined,
    dateTo: range.dateTo ? DateTimeManager.endOfDay(range.dateTo) : undefined,
  };
}
