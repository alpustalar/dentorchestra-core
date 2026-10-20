import { IGetContext } from '@common/decorators';
import type { ClosePeriod } from '@shared/modules/accounting-period/types/commands';

/**
 * Dönemi kapatır (doc 04 dönem kapanışı): yıl sonu fişlerini ürettirir (isteğe bağlı GRNI
 * tahakkuku, 7/A yansıtma, 6. sınıf → 690 → 590/591; posting modülü), sonra dönemi CLOSED'a
 * alır. İkisi atomik. Kapatılmış dönem yeniden açılamaz; düzeltme storno ile yapılır.
 *
 * `data.expectedLastEntryNo` önizlemenin döndürdüğü yevmiye sayacıdır: kapanış, önizlemeyi
 * görmeden ve önizlemeden sonra defter değişmişken çalıştırılamaz. `data.grniAccruals` boşsa
 * tahakkuk bilerek yapılmıyor demektir.
 */
export class ClosePeriodCommand {
  readonly __responseType!: void;
  constructor(
    public readonly payload: {
      readonly periodId: string;
      readonly data: ClosePeriod;
      readonly ctx: IGetContext;
    }
  ) {}
}
