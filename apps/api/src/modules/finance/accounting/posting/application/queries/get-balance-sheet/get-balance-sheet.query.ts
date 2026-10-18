import { IQuery } from '@nestjs/cqrs';
import { IGetContext } from '@common/decorators';
import { GetBalanceSheetResponse } from './get-balance-sheet.response';

/**
 * Bilanço — bir şubenin defterinden türetilen TDHP bilançosu.
 *
 * Bilanço bir **an** fotoğrafıdır, aralık toplamı değildir: varlık, kaynak ve öz
 * kaynak hesapları kümülatiftir — bakiyeleri defterin **başından** `asOf` tarihine
 * kadar birikir. Bu yüzden sorgunun tek tarih parametresi vardır.
 *
 * Eskiden `dateFrom`/`dateTo` alıyordu ve aralık mizana olduğu gibi geçiyordu:
 * `dateFrom` verildiğinde 100 Kasa'nın o tarihten önceki tüm hareketi, geçmiş
 * yılların kârı (590) ve açılış bakiyeleri **rapordan düşüyordu**. Hata sessizdi,
 * çünkü `isBalanced` o kurguda totolojiktir: pencerenin içindeki her fiş kendi
 * içinde dengeli olduğu için Aktif = Pasif yine tutar — yalnız her iki taraf da
 * birlikte eksik çıkar.
 *
 * `asOf` verilmezse bugüne kadarki tüm defter.
 */
export class GetBalanceSheetQuery implements IQuery {
  readonly __responseType!: GetBalanceSheetResponse;
  constructor(
    public readonly payload: {
      readonly clinicId: string;
      readonly ctx: IGetContext;
      readonly asOf?: Date;
    }
  ) {}
}
