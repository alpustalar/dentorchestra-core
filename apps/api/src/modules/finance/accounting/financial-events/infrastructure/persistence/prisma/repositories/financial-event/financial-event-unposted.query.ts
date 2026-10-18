import { JournalEntryStatus, Prisma } from '@prisma/client';
import { FinancialEventTypeType as FinancialEventType } from '@input-type-schemas/FinancialEventTypeSchema';

/**
 * "Fişlenmemiş ekonomik olay" tanımı tek yerde: hiç yevmiye fişi üretilmemiş ya da
 * fişi hâlâ DRAFT olan olaylar. (REVERSED fiş meşrudur: kayıt atılmış, sonra storno
 * edilmiştir.)
 *
 * Kapanış kapısı (Command Repo, karar) ve mutabakat listesi (Query Repo, rapor)
 * aynı tanımı görmek zorunda — iki kopya zamanla ayrışır ve dönem, fişsiz olay
 * varken kapanabilir hale gelirdi.
 */
export function unpostedFinancialEventWhere(params: {
  /** Verilmezse bütün defterler taranır (zamanlanmış süpürme işi için). */
  clinicId?: string;
  from: Date;
  to: Date;
  types: readonly FinancialEventType[];
}): Prisma.FinancialEventWhereInput {
  return {
    ...(params.clinicId ? { clinicId: params.clinicId } : {}),
    occurredAt: { gte: params.from, lte: params.to },
    // Yalnız fiş üretimi beklenen tipler: kuralı olmayan bir tip (STOCK_IN,
    // MANUAL_JOURNAL) hiç fişlenmeyeceği için kapsama girerse kapanış kilitlenir.
    type: { in: [...params.types] },
    OR: [
      { journalEntry: null },
      { journalEntry: { status: JournalEntryStatus.DRAFT } },
    ],
  };
}
