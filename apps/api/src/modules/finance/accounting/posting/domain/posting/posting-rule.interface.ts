import { FinancialEventTypeType as FinancialEventType } from '@input-type-schemas/FinancialEventTypeSchema';
import { CurrencyType } from '@input-type-schemas/CurrencySchema';
import { FinancialEvent } from '@shared';

/** Bir kuralın ürettiği ham fiş taslağı — hesaplar henüz kod (id değil). */
export interface DraftJournalLine {
  accountCode: string; // '120', '600.04', '391'...
  partyId?: string | null; // 120/320 için zorunlu
  debit?: string;
  credit?: string;
  desc?: string;

  /**
   * Bu satırın **orijinal para birimindeki** karşılığı.
   *
   * Yalnız gövde fonksiyonel parada yazılmışken o satırın altındaki yükümlülük
   * yabancı paraysa doldurulur: rezervasyon tahsilatında para TRY girer (iyzico)
   * ama 320 satırı sağlayıcıya **EUR** borçtur — TRY tutarı tek başına
   * yazılırsa tedarikçi mutabakatı kendi cinsinden yapılamaz.
   *
   * Fiş-seviyesi çevrim (`DraftJournalEntry.currency` ≠ fonksiyonel para) ile
   * **birlikte kullanılamaz**: aynı kolonları iki ayrı kaynak yazardı ve hangi
   * kurun geçerli olduğu belirsizleşirdi. Posting handler bu çakışmayı adıyla
   * reddeder.
   */
  originalDebit?: string;
  originalCredit?: string;
  originalCurrency?: CurrencyType;
  fxRate?: string;
}

export interface DraftJournalEntry {
  date: Date;
  description: string;
  /**
   * İşlemin orijinal para birimi. Belirtilmezse defterin fonksiyonel para birimi
   * varsayılır (çevirme yapılmaz). Yabancı para kuralları bunu event'ten doldurur;
   * posting handler fonksiyonel paraya çevirir (Model A).
   */
  currency?: CurrencyType;
  lines: DraftJournalLine[];
}

/**
 * Bir FinancialEvent'i çift taraflı fiş taslağına çeviren saf fonksiyon.
 * Aynı olay + aynı kural = aynı fiş (deterministik).
 *
 * Kural **yalnız olayı** okur. Eskiden ikinci bir `PostingContext` parametresi
 * (clinicId + organizationId) geçiliyordu ama dokuz kuralın **hiçbiri** onu
 * okumuyordu: fişin bütün girdileri olay gövdesinde duruyor, kiracı kimliği de
 * olayın kendisinde (`event.clinicId` / `event.organizationId`). Okunmayan bir
 * parametre güvence değil süstür (CLAUDE.md finans kuralı 10'un aynı mantığı) —
 * ayrıca her kuralda `no-unused-vars` borcu üretiyordu. Gerçekten gerekirse
 * olaydan türetilir ya da imza bilinçli olarak yeniden genişletilir.
 */
export interface PostingRule {
  readonly eventType: FinancialEventType;
  build(event: FinancialEvent): DraftJournalEntry;
}

export const POSTING_RULES = Symbol('POSTING_RULES');
