import { IGetContext } from '@common/decorators';
import type { ClosingBusinessType } from '@modules/finance/accounting/posting/domain/closing/year-end-closing.planner';
import type { GrniAccrualSelection } from '@shared/modules/accounting-period/types/commands';

export interface GenerateYearEndClosingInput {
  clinicId: string;
  organizationId: string;
  periodId: string;
  dateFrom: Date; // dönem başı (sonuç hesabı bakiyeleri bu aralıktan)
  dateTo: Date; // dönem sonu
  entryDate: Date; // kapanış fişlerinin tarihi (genelde dönem sonu)
  performedById?: string | null;
  /**
   * Ertesi yıl dönemi: GRNI ters kaydı ve öz kaynak devri oraya yazılır. Tahakkuk seçildiyse ya da
   * işletme biçimi doluysa zorunludur (çağıran dönemin var ve OPEN olduğunu baştan doğrular);
   * ikisi de yoksa `null`.
   */
  nextPeriod: { id: string; startsAt: Date } | null;
  /** Muhasebecinin tahakkuk seçimi. Boş liste "bilerek tahakkuk yok". Tutar içermez. */
  grniAccruals: readonly GrniAccrualSelection[];
  /** Kliniğin işletme biçimi (devir hedefini belirler). `null` → devir adımı atlanır. */
  businessType: ClosingBusinessType | null;
}

/**
 * Yıl sonu kapanış fişlerini üretir (doc 04 §5): isteğe bağlı GRNI tahakkuku, 7/A maliyet
 * yansıtması (7 → 6), tüm 6. sınıf sonuç hesaplarının 690 Dönem Kârı/Zararı'na kapatılması ve
 * 690 → 590 (net kâr) / 591 (net zarar) devri; işletme biçimi seçiliyse ertesi yılın 1 Ocak'ında 590/591 →
 * 570/580 (şirket) | 500 (şahıs) devri.
 * Sonuç hesaplarında hareket yoksa fiş üretilmez.
 *
 * Hesaplama saf planlayıcıdadır (`planYearEndClosing`); önizleme sorgusu aynı planlayıcıyı
 * kullanır. ClosePeriod tarafından dönem CLOSED'a alındıktan sonra, aynı transaction içinde çağrılır.
 */
export class GenerateYearEndClosingCommand {
  readonly __responseType!: void;
  constructor(
    public readonly input: GenerateYearEndClosingInput,
    public readonly ctx: IGetContext
  ) {}
}
