import { IQuery } from '@nestjs/cqrs';
import { IGetContext } from '@common/decorators';
import { GetChartOfAccountsDriftResponse } from './get-chart-of-accounts-drift.response';

/**
 * Şubenin fiilî hesap planı ile şablonun farkı (mutabakat raporu).
 *
 * Kurulum komutu yalnız **ekler**: şablonda bir alan düzeltildiğinde eski defterler
 * eski davranışı taşımaya devam eder ve bu fark hiçbir yerde görünmez. Şablon
 * düzenlendikten sonra bu uç ile hangi defterlerin ayrıştığı görülür.
 */
export class GetChartOfAccountsDriftQuery implements IQuery {
  readonly __responseType!: GetChartOfAccountsDriftResponse;
  constructor(
    public readonly clinicId: string,
    public readonly ctx: IGetContext
  ) {}
}
