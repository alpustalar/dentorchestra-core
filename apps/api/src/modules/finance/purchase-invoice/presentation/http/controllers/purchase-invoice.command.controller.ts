import {
  Body,
  Controller,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard, CapabilityGuard } from '@modules/identity/auth/auth/guards';
import { GetContext, HasCapability, IGetContext } from '@common/decorators';
import {
  CancelPurchaseInvoiceDto,
  MatchPurchaseInvoiceDto,
  RecordPurchaseInvoiceDto,
} from '@shared/modules/purchase-invoice/dto/commands';
import { TSCommandBus } from '@common/cqrs/type-safe-command-bus';
import { RecordPurchaseInvoiceCommand } from '@modules/finance/purchase-invoice/application/commands/record-purchase-invoice/record-purchase-invoice.command';
import { MatchPurchaseInvoiceCommand } from '@modules/finance/purchase-invoice/application/commands/match-purchase-invoice/match-purchase-invoice.command';
import { UnmatchPurchaseInvoiceCommand } from '@modules/finance/purchase-invoice/application/commands/unmatch-purchase-invoice/unmatch-purchase-invoice.command';
import { CancelPurchaseInvoiceCommand } from '@modules/finance/purchase-invoice/application/commands/cancel-purchase-invoice/cancel-purchase-invoice.command';
import { CAPABILITIES } from '@src/infrastructure/persistence/prisma/data/modules';

const { PURCHASEINVOICE } = CAPABILITIES;
@UseGuards(AuthGuard, CapabilityGuard)
@Controller()
export class PurchaseInvoiceCommandController {
  constructor(private readonly commandBus: TSCommandBus) {}

  @HasCapability(PURCHASEINVOICE.create)
  @Post()
  record(
    @Body() dto: RecordPurchaseInvoiceDto,
    @GetContext() ctx: IGetContext
  ) {
    return this.commandBus.execute(new RecordPurchaseInvoiceCommand(dto, ctx));
  }

  /** Kaydedilmiş faturayı sonradan bir satın alma siparişine eşleştirir. */
  @HasCapability(PURCHASEINVOICE.update)
  @Put(':invoiceId/match')
  match(
    @Param('invoiceId', ParseUUIDPipe) invoiceId: string,
    @Body() dto: MatchPurchaseInvoiceDto,
    @GetContext() ctx: IGetContext
  ) {
    return this.commandBus.execute(
      new MatchPurchaseInvoiceCommand({ invoiceId, data: dto, ctx })
    );
  }

  @HasCapability(PURCHASEINVOICE.update)
  @Put(':invoiceId/unmatch')
  unmatch(
    @Param('invoiceId', ParseUUIDPipe) invoiceId: string,
    @GetContext() ctx: IGetContext
  ) {
    return this.commandBus.execute(
      new UnmatchPurchaseInvoiceCommand(invoiceId, ctx)
    );
  }

  /**
   * Alış faturası iptali (storno): 320 borcu ve gider/stok kaydı ters kayıtla
   * götürülür, bağlı siparişin faturalanmış tutarı düşülür.
   *
   * Yetki `update` değil **`delete`**: bir borcu hükümsüz kılmak yıkıcı bir
   * düzeltmedir ve fatura kaydetmekle aynı yetkiye bağlanmamalıdır (CLAUDE.md
   * finans kuralı 7).
   */
  @HasCapability(PURCHASEINVOICE.delete)
  @Post(':invoiceId/cancel')
  cancel(
    @Param('invoiceId', ParseUUIDPipe) invoiceId: string,
    @Body() dto: CancelPurchaseInvoiceDto,
    @GetContext() ctx: IGetContext
  ) {
    return this.commandBus.execute(
      new CancelPurchaseInvoiceCommand({ invoiceId, data: dto, ctx })
    );
  }
}
