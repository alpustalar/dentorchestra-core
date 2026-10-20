import { IQuery } from '@nestjs/cqrs';
import { IGetContext } from '@common/decorators';
import type { GetYearEndClosingPreview } from '@shared/modules/accounting-period/types/queries';
import { GetYearEndClosingPreviewResponse } from './get-year-end-closing-preview.response';

/**
 * Yıl sonu kapanış **önizlemesi**: kapanışın üreteceği fişleri, tutarları, blokajları ve
 * uyarıları HİÇBİR ŞEY YAZMADAN gösterir.
 *
 * Kapanış geri alınamaz (CLOSED'dan dönüş yok); bu yüzden önizlemesiz çalıştırılamaz —
 * `POST close` önizlemenin döndürdüğü yevmiye sayacını geri ister. Önizleme ile kapanış AYNI
 * saf planlayıcıyı (`planYearEndClosing`) ve AYNI GRNI aday hesabını kullanır: gösterilen
 * tutar ile yazılan tutar ayrı kod yollarından gelseydi sessizce ayrışırdı.
 */
export class GetYearEndClosingPreviewQuery implements IQuery {
  readonly __responseType!: GetYearEndClosingPreviewResponse;
  constructor(
    public readonly payload: {
      readonly periodId: string;
      readonly filter: GetYearEndClosingPreview;
      readonly ctx: IGetContext;
    }
  ) {}
}
