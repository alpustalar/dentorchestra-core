import { IBaseCommandRepository } from '@common/domain/repositories/base-command-repository.interface';
import { AccountingPeriod } from '@modules/finance/accounting/periods/domain/entities/accounting-period.entity';

export const ACCOUNTING_PERIOD_COMMAND_REPOSITORY = Symbol(
  'IAccountingPeriodCommandRepository'
);

export type IAccountingPeriodCommandRepository =
  IBaseCommandRepository<AccountingPeriod> & {
    /**
     * Dönemi atomik olarak kapanışa "sahiplenir": OPEN/LOCKED → CLOSED tek bir
     * koşullu UPDATE ile yapılır (denetim damgaları entity'den gelir). Eşzamanlı
     * ikinci istek 0 satır etkiler (satır kilidi commit'i bekler, sonra CLOSED
     * görür) → `false` döner. Böylece mükerrer yıl sonu kapanış fişi üretimi
     * (check-then-act yarışı) önlenir. Başarılıysa entity'nin event'leri flush edilir.
     * @returns dönemi bu çağrı kapattıysa `true`, zaten kapalıysa `false`
     */
    claimForClosing(period: AccountingPeriod): Promise<boolean>;

    /**
     * OPEN → LOCKED koşullu geçiş. Koşulsuz `update(entity)` kullanılmaz: tüm
     * satırı yazdığı için araya giren bir kapanışı (CLOSED) geri alır ve kapanış
     * fişleri atılmış dönemi yeniden yazılabilir hale getirir (lost update).
     * @returns geçiş bu çağrıyla uygulandıysa `true`
     */
    claimForLocking(period: AccountingPeriod): Promise<boolean>;

    /** LOCKED → OPEN koşullu geçiş; gerekçesi {@link claimForLocking} ile aynı. */
    claimForReopening(period: AccountingPeriod): Promise<boolean>;

    /**
     * Yevmiye numarasını dönem satırındaki sayaçtan **kilit altında** tahsis eder:
     * `UPDATE ... SET last_entry_no = last_entry_no + 1 WHERE id = ? AND status = 'OPEN'
     * RETURNING last_entry_no`.
     *
     * İki işi birlikte yapar (CLAUDE.md "kilitli skaler okuma" istisnası):
     * 1. Numarayı serileştirir → mükerrer `entry_no` imkânsız (MAX+1 kilitsizdi).
     * 2. Dönem satırını kilitler → eşzamanlı kapanış bu tx commit olana kadar bekler;
     *    kapanış önce commit olduysa `status='OPEN'` koşulu 0 satır döner ve fiş reddedilir.
     *
     * Bu yüzden **fişin yazıldığı transaction içinde** çağrılmak zorundadır; aksi halde
     * numara ayrı commit edilip kayıp (boşluk) üretir ve kilit anında serbest kalır.
     */
    lockAndAllocateEntryNo(periodId: string): Promise<bigint>;

    /**
     * Kapanış fişleri için numara tahsisi — durum koşulu **yoktur**.
     * Yalnız yıl sonu kapanış akışından çağrılır: o akış aynı transaction içinde
     * `claimForClosing` ile dönemi CLOSED'a çekmiş ve satır kilidini zaten almıştır,
     * dolayısıyla `status='OPEN'` koşulu kendi kapanış fişini bloke ederdi.
     */
    lockAndAllocateClosingEntryNo(periodId: string): Promise<bigint>;

    /**
     * Yıl için mevcut dönem (entity). Dönem açma akışında "zaten var mı" kararını
     * beslediği için Command Context'e aittir — replica gecikmesi mükerrer dönem
     * açma denemesine yol açardı (nihai güvence `clinicId_year` unique kısıtı).
     */
    findByYear(
      clinicId: string,
      year: number
    ): Promise<AccountingPeriod | null>;

    /**
     * Verilen tarihin düştüğü dönem (entity).
     *
     * Query Repo'da da aynı adlı bir okuma var; bu kopya değil, **bağlam
     * farkıdır**: buradaki okuma bir yazmayı kapıda durdurur (belge tarihi
     * mühürlenmiş döneme düşüyorsa kayıt reddedilir), dolayısıyla Command
     * Context'e aittir. Replica gecikmesiyle "dönem hâlâ açık" görülürse belge
     * kabul edilir, fişi hiç üretilemez ve append-only olduğu için düzeltilemez.
     */
    findByDate(clinicId: string, date: Date): Promise<AccountingPeriod | null>;

    /**
     * Verilen yıldan ÖNCEKİ, henüz kapanmamış (OPEN/LOCKED) dönemler — en eski önce.
     *
     * Yıl sonu kapanışının sıra kapısını besler ("önceki yıl kapanmadan sonraki kapatılamaz")
     * ve kapanışı durdurabildiği için Command Context'e aittir. CLOSED dönem geri dönmediği
     * (reopen yalnız LOCKED'ı açar) için bu okumada yarış yoktur: kapalı görünen dönem
     * kapalı kalır.
     */
    findNotClosedBefore(
      clinicId: string,
      year: number
    ): Promise<AccountingPeriod[]>;

    /**
     * Defteri olan (en az bir dönemi açılmış) klinikler. Yıllık dönem açma işi
     * bu listeden yürür: yeni yıl dönemi yalnız muhasebesi kurulmuş klinikler için
     * gerekir ve böylece Clinic modülüne bağımlılık doğmaz.
     */
    findLedgerScopes(): Promise<LedgerScope[]>;
  };

/** Defteri olan bir klinik ve kiracı bağı (yıllık dönem açma işi için). */
export interface LedgerScope {
  clinicId: string;
  organizationId: string;
}
