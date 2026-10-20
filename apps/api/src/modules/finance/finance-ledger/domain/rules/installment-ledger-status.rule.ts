import {
  InstallmentStatusSchema,
  LedgerStatusSchema,
} from '@shared/generated-zod';
import type { InstallmentStatusType } from '@input-type-schemas/InstallmentStatusSchema';
import type { LedgerStatusType } from '@input-type-schemas/LedgerStatusSchema';

/**
 * Taksit durumu → cari kaydın olması gereken durumu.
 *
 * **Tek sabit**: hem yazma yolu (`SyncInstallmentLedgerEntryCommand`) hem
 * mutabakat raporu (`FindLedgerMismatchesQuery`) beklenen durumu buradan
 * türetir. İki kopya eşleme, raporun "fark yok" dediği bir kaydı yazma
 * yolunun farklı doldurmasına yol açardı (CLAUDE.md finans kuralı 12).
 *
 * `null` = defterde karşılığı **olmamalı** (parası hareket etmemiş taksit).
 */
const LEDGER_STATUS_BY_INSTALLMENT_STATUS: Record<
  InstallmentStatusType,
  LedgerStatusType | null
> = {
  [InstallmentStatusSchema.enum.COMPLETED]: LedgerStatusSchema.enum.COMPLETED,
  [InstallmentStatusSchema.enum.REFUNDED]: LedgerStatusSchema.enum.REFUNDED,
  // Ters ibraz (kaybedilen kart itirazı): para iade edilmedi, geri ALINDI. Cari
  // kayıt REFUNDED değil kendi durumunu taşır — gelirden düşer ama iade
  // raporlarına karışmaz.
  [InstallmentStatusSchema.enum.CHARGED_BACK]:
    LedgerStatusSchema.enum.CHARGED_BACK,
  [InstallmentStatusSchema.enum.CANCELLED]: null,
  [InstallmentStatusSchema.enum.PENDING]: null,
  [InstallmentStatusSchema.enum.OVERDUE]: null,
};

export const ledgerStatusForInstallment = (
  status: InstallmentStatusType
): LedgerStatusType | null => LEDGER_STATUS_BY_INSTALLMENT_STATUS[status];
