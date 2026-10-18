import { ICommand } from '@nestjs/cqrs';
import { IGetContext } from '@common/decorators';
import { BackfillMissingInvoicesResponse } from './backfill-missing-invoices.response';
import { FindUninvoicedPaymentsFilter } from '@modules/finance/invoice/domain/contracts/invoice';

/**
 * Faturası kesilmemiş tahsilatları yeniden faturalar (backfill).
 *
 * Fatura kesimi olay güdümlüdür ve tetikleyici dinleyiciler hata yutuyor
 * (CRITICAL alarm + elle müdahale). CLAUDE.md finans kuralı 4 yutulan her kritik
 * iş için ya retry ya **backfill + eksikler sorgusu** istiyor: sorgu
 * `FindUninvoicedPaymentsQuery`, telafi yolu bu komut.
 *
 * `IssueInvoiceCommand` idempotent olduğu için (doğal anahtar + unique kısıt)
 * komut tekrar tekrar çalıştırılabilir.
 */
export class BackfillMissingInvoicesCommand implements ICommand {
  readonly __responseType!: BackfillMissingInvoicesResponse;
  constructor(
    public readonly payload: {
      readonly filter: FindUninvoicedPaymentsFilter;
      readonly ctx: IGetContext;
    }
  ) {}
}
