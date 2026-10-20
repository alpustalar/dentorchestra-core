import { JournalEntryKind, JournalEntryStatus, Prisma } from '@prisma/client';
import { Pagination, JournalEntry as IJournalEntry } from '@shared';
import { JournalEntry } from '../entities/journal-entry.entity';

export const JOURNAL_COMMAND_REPOSITORY = Symbol('IJournalCommandRepository');
export const JOURNAL_QUERY_REPOSITORY = Symbol('IJournalQueryRepository');

export interface FindJournalEntriesFilter {
  /**
   * Defter **şubenin** (klinik) defteridir; yalnız `organizationId` ile süzmek aynı
   * organizasyondaki *başka kliniğin* fişlerini de getirir (franchise'da başka bir
   * işletme). İkisi birlikte verilir: org kiracı sınırı, klinik defter sınırı.
   */
  clinicId: string;
  organizationId: string;
  status?: JournalEntryStatus;
  periodId?: string;
}

/** Mizan filtresi — şube (defter) bazlı, opsiyonel tarih aralığı. */
export interface TrialBalanceFilter {
  clinicId: string;
  dateFrom?: Date;
  dateTo?: Date;
  /**
   * Hangi fiş nitelikleri sayılsın? Verilmezse **hepsi** — mizanın, bilançonun ve
   * yıl sonu kapanışının kendisinin istediği budur. Tek daraltan tüketici gelir
   * tablosudur (`INCOME_STATEMENT_ENTRY_KINDS`): kapanış fişi 6/7'yi sıfırladığı
   * için sayılırsa kapanmış yılın cirosu sıfır görünür.
   */
  kinds?: readonly JournalEntryKind[];
}

/** Hesap bazında ham borç/alacak toplamı (defterde etkili fiş satırları). */
export interface TrialBalanceRow {
  accountId: string;
  totalDebit: Prisma.Decimal;
  totalCredit: Prisma.Decimal;
}

/** Defter-i Kebir filtresi — bir hesabın şube bazlı hareketleri. */
export interface AccountLedgerFilter {
  clinicId: string;
  accountId: string;
  dateFrom?: Date;
  dateTo?: Date;
}

/** Bir hesabın tek fiş satırı hareketi (kebir dökümü için). */
export interface LedgerMovementRow {
  entryId: string;
  entryNo: bigint | null;
  entryDate: Date;
  description: string | null; // fiş açıklaması
  lineDesc: string | null; // satır açıklaması
  debit: Prisma.Decimal;
  credit: Prisma.Decimal;
}

export interface AccountLedger {
  openingBalance: Prisma.Decimal; // dateFrom öncesi devir (yoksa 0)
  movements: LedgerMovementRow[]; // entryDate, entryNo sırasında
}

/**
 * Banka mutabakatı aday filtresi — verilen hesapların (102) POSTED satırları.
 * Tarih aralığı ekstre dönemi + tolerans kadar genişletilmiş hâlde gelir.
 */
export interface BankLedgerLinesFilter {
  clinicId: string;
  accountIds: string[];
  dateFrom: Date;
  dateTo: Date;
}

/**
 * Mutabakat adayı olarak dönen tek fiş satırı. `lineId` eşleşince ekstre
 * satırında `matchedRef` olarak saklanır — bu yüzden satır kimliği zorunludur
 * (mevcut `LedgerMovementRow` yalnız fiş kimliği taşır, aday tekilliğine yetmez).
 */
export interface BankLedgerLineRow {
  lineId: string;
  entryId: string;
  entryNo: bigint | null;
  entryDate: Date;
  entryDescription: string | null;
  lineDesc: string | null;
  debit: Prisma.Decimal;
  credit: Prisma.Decimal;
}

/** Yevmiye Defteri filtresi — şube bazlı, kronolojik POSTED fişler. */
export interface JournalReportFilter {
  clinicId: string;
  dateFrom?: Date;
  dateTo?: Date;
}

/**
 * Nakit akışı filtresi — şube bazlı; nakit/banka hesap id'leri (10x) handler'da
 * hesap planından çözülüp verilir (repo kodları bilmez, yalnız id ile çalışır).
 */
export interface CashFlowFilter {
  clinicId: string;
  accountIds: string[];
  dateFrom?: Date;
  dateTo?: Date;
}

/** Nakit hesaplarındaki tek satır hareketi (aylık grup için ham veri). */
export interface CashMovementRow {
  entryDate: Date;
  debit: Prisma.Decimal; // nakit girişi
  credit: Prisma.Decimal; // nakit çıkışı
}

export interface CashFlow {
  openingBalance: Prisma.Decimal; // dateFrom öncesi net nakit pozisyonu
  movements: CashMovementRow[]; // entryDate sırasında
}

/**
 * KDV beyan filtresi — şube bazlı; 391 (Hesaplanan) ve 191 (İndirilecek) KDV hesap
 * id'leri handler'da hesap planından çözülüp verilir (repo kodları bilmez, yalnız id).
 */
export interface VatDeclarationFilter {
  clinicId: string;
  outputAccountIds: string[]; // 391x Hesaplanan KDV
  inputAccountIds: string[]; // 191x İndirilecek KDV
  dateFrom?: Date;
  dateTo?: Date;
}

/** KDV hesabındaki tek satır hareketi (aylık grup için ham veri). */
export interface VatMovementRow {
  entryDate: Date;
  debit: Prisma.Decimal;
  credit: Prisma.Decimal;
}

export interface VatDeclaration {
  output: VatMovementRow[]; // 391 hareketleri (hesaplanan = alacak - borç)
  input: VatMovementRow[]; // 191 hareketleri (indirilecek = borç - alacak)
}

/** Yevmiye dökümü satırı — fiş başlığı + ham satırları (rapor projeksiyonu). */
export interface JournalReportLineRow {
  accountId: string;
  partyId: string | null;
  debit: Prisma.Decimal;
  credit: Prisma.Decimal;
  lineDesc: string | null;
}

export interface JournalReportRow {
  id: string;
  entryNo: bigint | null;
  entryDate: Date;
  description: string | null;
  status: JournalEntryStatus;
  lines: JournalReportLineRow[];
}

/** Kilitli kontrol hesabı bakiyesi okuması — tek şube, tek hesap. */
export interface AccountBalanceLockParams {
  clinicId: string;
  accountId: string;
}

export interface IJournalCommandRepository {
  /** Fişi satırlarıyla birlikte yazar. */
  create(entry: JournalEntry): Promise<JournalEntry>;

  // Yevmiye numarası buradan tahsis EDİLMEZ: numara dönem satırındaki sayaçtan,
  // kilit altında alınır (`IJournalEntryNumberingService`). Eski `nextEntryNo`
  // (MAX+1) kilitsiz olduğu için iki eşzamanlı fişe aynı numarayı veriyordu.

  /**
   * Storno linkajı: orijinal fişi REVERSED yapar + reversedById'yi ayarlar (hedefli
   * scalar update). Defter append-only olduğu için tek meşru mutasyon budur.
   */
  applyReversal(entry: JournalEntry): Promise<void>;

  /**
   * Storno edilecek fişi satırlarıyla + `FOR UPDATE` kilidiyle okur. Fiş REVERSED
   * işaretleneceği için Command Context'e aittir; kilit olmadan iki eşzamanlı storno
   * isteği aynı POSTED fişi görüp iki ters kayıt üretebilirdi (`ensureReversible`
   * yalnız kendi kopyasını korur).
   */
  findByIdForUpdate(id: string): Promise<JournalEntry | null>;

  /**
   * Olayın fişi zaten atılmış mı? Fiş yazılıp yazılmayacağı kararını beslediği için
   * Command Context'te okunur; nihai güvence `event_id` unique kısıtıdır.
   */
  findByEventId(eventId: string): Promise<JournalEntry | null>;

  /**
   * Bir kontrol hesabının (108 gibi) bakiyesini **kilit altında** okur:
   * `Σborç − Σalacak` (defterde etkili fiş satırları).
   *
   * Kilit ile okuma **tek metotta** (CLAUDE.md `lockAndGet*` kuralı): ayrı
   * metotlara bölünürse çağrı sırası derleyiciye görünmez olur ve bakiye kararı
   * sessizce kilitsiz veriyle verilir. Kilit bir satıra değil **kavrama**
   * tutulur (hesabın bakiyesi binlerce satırın toplamıdır) — bu yüzden danışma
   * kilidi kullanılır ve fiş yazan diğer akışlar bloklanmaz.
   *
   * Yazma kararını beslediği için Command Context'tedir: kart hesap kapamasının
   * (108 → 102 + 653) mevcut bakiyeyi aşmaması buradan doğrulanır.
   */
  lockAndGetAccountBalance(
    params: AccountBalanceLockParams
  ): Promise<Prisma.Decimal>;

  /**
   * 108'de **harcanabilir** tutar: fişlenmiş bakiye − henüz fişlenmemiş (olayı
   * yazılmış, fişi outbox'ta bekleyen) hesap kapaması / itiraz kesintileri.
   *
   * Neden ayrı: kapama bir *olay* yazar, fiş sonradan üretilir; bakiye yalnız
   * fişlenmişi görürse ilk kapamanın fişi gelene kadar ikinci kapama aynı parayı
   * ikinci kez harcar (1000'lik bakiyeden 600 + 600) ve 108 eksiye düşer. Fiş
   * kendi içinde dengeli olduğu için hiçbir kontrol yakalamaz (kural 13: sıra
   * zamanlamaya bırakılmaz). Kilit ile iki okuma **tek metotta** (`lockAndGet*`).
   */
  lockAndGetSpendableFundsInTransit(
    params: AccountBalanceLockParams
  ): Promise<Prisma.Decimal>;

  /**
   * Mizan — yıl sonu kapanış fişinin tutarlarını üretir. Rapor değil yazma kararı
   * olduğu için Command Context'ten okunur (replica gecikmesi eksik bakiye ile
   * kapanış fişi üretirdi).
   */
  trialBalance(filter: TrialBalanceFilter): Promise<TrialBalanceRow[]>;
}

/** Okuma tarafı: entity değil, plain model / read-model döner. */
export interface IJournalQueryRepository {
  findMany(
    filter: FindJournalEntriesFilter,
    pagination: Pagination
  ): Promise<{ items: IJournalEntry[]; total: number }>;

  /** Mizan: hesap bazında borç/alacak toplamı (POSTED fiş satırları). */
  trialBalance(filter: TrialBalanceFilter): Promise<TrialBalanceRow[]>;

  /** Defter-i Kebir: bir hesabın sıralı hareketleri + açılış devri. */
  accountLedger(filter: AccountLedgerFilter): Promise<AccountLedger>;

  /** Yevmiye Defteri: kronolojik POSTED fişler (entryDate, entryNo sırasında). */
  journalReport(
    filter: JournalReportFilter,
    pagination: Pagination
  ): Promise<{ items: JournalReportRow[]; total: number }>;

  /** Nakit akışı: nakit/banka hesaplarının POSTED hareketleri + açılış devri. */
  cashFlow(filter: CashFlowFilter): Promise<CashFlow>;

  /** KDV beyan özeti: 391/191 POSTED hareketleri (aylık gruplama handler'da). */
  vatDeclaration(filter: VatDeclarationFilter): Promise<VatDeclaration>;

  /**
   * Banka mutabakatı adayları: verilen hesapların tarih aralığındaki POSTED
   * satırları (satır kimliğiyle). Eşleştirme kararını banka modülü verir; burası
   * yalnız ham hareketi döndürür.
   */
  bankLedgerLines(filter: BankLedgerLinesFilter): Promise<BankLedgerLineRow[]>;
}
