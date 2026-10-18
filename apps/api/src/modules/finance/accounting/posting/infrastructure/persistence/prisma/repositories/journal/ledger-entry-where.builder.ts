import { JournalEntryKind, Prisma } from '@prisma/client';
import { LEDGER_EFFECTIVE_ENTRY_STATUSES } from '@modules/finance/accounting/posting/domain/posting/ledger-effective-status.constant';
import {
  ReportDateRange,
  normalizeReportDateRange,
} from '@modules/finance/shared/domain/reporting/report-date-range';

export interface LedgerEntryWhereProps {
  clinicId: string;
  dateFrom?: Date;
  dateTo?: Date;
  /** Verilmezse bütün nitelikler sayılır (bilanço, mizan, yevmiye defteri). */
  kinds?: readonly JournalEntryKind[];
}

export interface LedgerEntryWhere {
  /** Rapor gövdesi: aralık + durum + nitelik süzgeçleri uygulanmış fiş filtresi. */
  readonly entry: Prisma.JournalEntryWhereInput;
  /**
   * Açılış devri: aralığın başlangıcından **önceki** etkili fişler. `dateFrom`
   * verilmediyse `null` — açık uçlu raporda devir diye bir şey yoktur.
   */
  readonly opening: Prisma.JournalEntryWhereInput | null;
  /** Gün sınırına genişletilmiş aralık (rapor başlığında geri gösterilmek üzere). */
  readonly range: ReportDateRange;
}

/**
 * Defter raporlarının **tek** fiş filtresi kurucusu.
 *
 * Üç kuralı birlikte garanti eder ve hiçbirini çağırana bırakmaz:
 *
 * 1. **Durum süzgeci** — `LEDGER_EFFECTIVE_ENTRY_STATUSES` (POSTED + REVERSED).
 *    Storno defterden kayıt silmez; yalnız POSTED süzmek bakiyeyi ters işaretle
 *    yanlış gösterir (CLAUDE.md finans kuralı 8).
 * 2. **Gün sınırı** — aralık `normalizeReportDateRange` ile gün başına/sonuna
 *    genişletilir; ham `lte: dateTo` aralığın son gününü düşürüyordu.
 * 3. **Devir ↔ hareket bölüşümü** — açılış devri (`lt: dateFrom`) ile hareketler
 *    (`gte: dateFrom`) **aynı** normalize edilmiş değerden türetilir. İki ayrı
 *    yerde hesaplanırsa bir fiş ya iki kez sayılır ya hiç sayılmaz; kebir/nakit
 *    akışı raporunda bu, kapanış bakiyesinin sessizce kaymasıdır.
 *
 * Bunlar altı sorguda elle tekrarlanıyordu: yeni bir rapor metodu üçünden
 * herhangi birini unutabilir ve sonucu yine "dengeli" görünürdü.
 */
export function buildLedgerEntryWhere(
  props: LedgerEntryWhereProps
): LedgerEntryWhere {
  const range = normalizeReportDateRange(props);

  const base: Prisma.JournalEntryWhereInput = {
    clinicId: props.clinicId,
    status: { in: [...LEDGER_EFFECTIVE_ENTRY_STATUSES] },
    ...(props.kinds ? { kind: { in: [...props.kinds] } } : {}),
  };

  const entry: Prisma.JournalEntryWhereInput = { ...base };
  if (range.dateFrom || range.dateTo) {
    entry.entryDate = { gte: range.dateFrom, lte: range.dateTo };
  }

  return {
    entry,
    opening: range.dateFrom
      ? { ...base, entryDate: { lt: range.dateFrom } }
      : null,
    range,
  };
}
