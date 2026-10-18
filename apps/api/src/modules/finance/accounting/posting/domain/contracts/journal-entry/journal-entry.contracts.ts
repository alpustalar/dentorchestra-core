import { JournalEntryKindType as JournalEntryKind } from '@input-type-schemas/JournalEntryKindSchema';
import { LogSource } from '@src/domain/constants/log-action.constant';
import { CreateJournalEntryLineProps } from '@modules/finance/accounting/posting/domain/contracts/journal-line';

export interface CreateJournalEntryProps {
  id?: string;
  clinicId: string; // defter sahibi şube (source-of-truth)
  organizationId: string; // denormalize — konsolide raporlama
  periodId: string; // İlgili mali dönem ID'si
  entryDate: Date;
  description?: string | null;
  eventId?: string | null;
  performedById?: string | null;

  /**
   * Fişin niteliği. Verilmezse `OPERATIONAL` — posting kurallarının ürettiği
   * ekonomik fişlerin tamamı budur. Yalnız dönem sonu tekniği (`CLOSING`) açıkça
   * geçilir; storno ise niteliği **devralır** (`buildReversalDraft`).
   */
  kind?: JournalEntryKind;

  // Alt satırlar dizisi. En az 2 satır zorunludur — JournalLines VO'da doğrulanır.
  lines: CreateJournalEntryLineProps[];
}

/**
 * Storno (ters kayıt) taslağı üretmek için gereken veriler. Storno yeni bir fiştir;
 * kendi dönemine + numara akışına girer, eventId taşımaz.
 */
export interface BuildReversalDraftProps {
  reversalId: string;
  periodId: string;
  entryDate: Date;
  description?: string | null;
  performedById?: string | null;
}

/**
 * Orijinal fişi storno'ya bağlarken gereken veriler. `actorId`/`source` denetim
 * olayı içindir: storno kaydı kimin ne zaman yaptığı bilgisi olmadan defterde
 * izsiz bir düzeltme olurdu.
 */
export interface MarkReversedProps {
  reversalId: string;
  actorId: string;
  reason?: string | null;
  source?: LogSource;
}
