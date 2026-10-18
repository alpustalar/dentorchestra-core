import {
  Body,
  Controller,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard, CapabilityGuard } from '@modules/identity/auth/auth/guards';
import { GetContext, HasCapability, IGetContext } from '@common/decorators';
import { TSCommandBus } from '@common/cqrs/type-safe-command-bus';
import { BackfillMissingInvoicesCommand } from '@modules/finance/invoice/application/commands/backfill-missing-invoices/backfill-missing-invoices.command';
import { CancelInvoiceCommand } from '@modules/finance/invoice/application/commands/cancel-invoice/cancel-invoice.command';
import {
  BackfillMissingInvoicesDto,
  CancelInvoiceDto,
} from '@shared/modules/invoice/dto/commands';
import { CAPABILITIES } from '@src/infrastructure/persistence/prisma/data/modules';

/**
 * Faturanın elle yazma uçları iki tanedir:
 * - **telafi** (backfill): normal akışta fatura elle kesilmez, olay güdümlü
 *   üretilir. Bu uç, dinleyicinin hata yutması sonucu hiç kesilmemiş faturaları
 *   yeniden üretir (CLAUDE.md finans kuralı 4).
 * - **iptal** (storno): hatalı kesilmiş belgeyi hükümsüz kılar.
 */
const { INVOICE } = CAPABILITIES;
@UseGuards(AuthGuard, CapabilityGuard)
@Controller()
export class InvoiceCommandController {
  constructor(private readonly commandBus: TSCommandBus) {}

  @HasCapability(INVOICE.create)
  @Post('backfill')
  backfill(
    @Body() dto: BackfillMissingInvoicesDto,
    @GetContext() ctx: IGetContext
  ) {
    return this.commandBus.execute(
      new BackfillMissingInvoicesCommand({ filter: dto, ctx })
    );
  }

  /**
   * Fatura iptali (storno): belge CANCELLED damgalanır, defterdeki hasılat/KDV
   * etkisi ters kayıtla götürülür ve e-belge gönderilmişse entegratör iptal
   * bildirimi kuyruğa alınır.
   *
   * Yetki `create`/`update` değil **`delete`**: iptal, defterdeki bir kaydın
   * etkisini götüren yıkıcı bir düzeltmedir ve fatura kesmekle (ki normalde onu
   * sistem yapar) aynı yetkiye bağlanmamalıdır (CLAUDE.md finans kuralı 7 —
   * yevmiye storno ucuyla aynı ölçüt).
   */
  @HasCapability(INVOICE.delete)
  @Post(':invoiceId/cancel')
  cancel(
    @Param('invoiceId', ParseUUIDPipe) invoiceId: string,
    @Body() dto: CancelInvoiceDto,
    @GetContext() ctx: IGetContext
  ) {
    return this.commandBus.execute(
      new CancelInvoiceCommand({ invoiceId, data: dto, ctx })
    );
  }
}
