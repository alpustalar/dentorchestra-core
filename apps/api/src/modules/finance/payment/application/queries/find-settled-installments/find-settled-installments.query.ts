import { IQuery } from '@nestjs/cqrs';
import { IGetContext } from '@common/decorators';
import { FindSettledInstallmentsResponse } from './find-settled-installments.response';
import { FindSettledInstallmentsFilter } from '@modules/finance/payment/domain/contracts/payment';

/**
 * Aralıkta sonuçlanmış (tahsil/iade) taksitler — cari defter mutabakatının
 * kaynak tarafı. Defterin ne yazdığını bu modül bilmez (bounded context).
 */
export class FindSettledInstallmentsQuery implements IQuery {
  readonly __responseType!: FindSettledInstallmentsResponse;
  constructor(
    public readonly payload: {
      readonly filter: FindSettledInstallmentsFilter;
      readonly ctx: IGetContext;
    }
  ) {}
}
