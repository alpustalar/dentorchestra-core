import {
  AccountingPeriodStatusSchema,
  AccountingPeriodStatusType as AccountingPeriodStatus,
} from '@input-type-schemas/AccountingPeriodStatusSchema';

/**
 * Fiş yazılabilen dönem durumları — **tek kabul kümesi** (CLAUDE.md finans
 * kuralı 12).
 *
 * İki yer bu kümeyi görmek zorundadır ve ikisi aynı olmalıdır:
 *  1. **Kullanım yeri** — posting, fişi yazarken dönemi bu kümeye göre süzer
 *     (otoriter kapı yine `lockAndAllocateEntryNo`'nun `status='OPEN'` koşulu).
 *  2. **Yazma kapısı** — belge tarihini kullanıcıdan alan komutlar
 *     (`PERIOD_GATE_SERVICE`), tarihi mühürlenmiş bir döneme düşen belgeyi
 *     kabul etmemek için.
 *
 * Kopya liste yazılırsa kapı ile kullanım yeri ayrışır: yazılabilen ama
 * fişlenemeyen belge üretilir ve olay defteri append-only olduğu için düzeltme
 * imkânı kalmaz.
 */
export const POSTABLE_PERIOD_STATUSES: readonly AccountingPeriodStatus[] = [
  AccountingPeriodStatusSchema.enum.OPEN,
];

/** Dönem fiş kabul ediyor mu (LOCKED/CLOSED mühürlüdür). */
export function isPeriodPostable(status: AccountingPeriodStatus): boolean {
  return POSTABLE_PERIOD_STATUSES.includes(status);
}
