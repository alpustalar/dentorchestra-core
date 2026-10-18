import { IQuery } from '@nestjs/cqrs';
import { IGetContext } from '@common/decorators';
import { FindUninvoicedPaymentsResponse } from './find-uninvoiced-payments.response';
import { FindUninvoicedPaymentsFilter } from '@modules/finance/invoice/domain/contracts/invoice';

/**
 * Tahsilatı alınmış ama faturası kesilmemiş ödemeler (mutabakat).
 *
 * "Yutulan kritik iş için görünürlük" gereğini karşılar (CLAUDE.md finans kuralı 4):
 * fatura kesimi olay güdümlüdür ve dinleyici hatayı yutarsa fatura HİÇ oluşmaz —
 * ekonomik olay da yazılmadığı için fişleme mutabakatı bunu göremez.
 */
export class FindUninvoicedPaymentsQuery implements IQuery {
  readonly __responseType!: FindUninvoicedPaymentsResponse;
  constructor(
    public readonly payload: {
      readonly filter: FindUninvoicedPaymentsFilter;
      readonly ctx: IGetContext;
    }
  ) {}
}
