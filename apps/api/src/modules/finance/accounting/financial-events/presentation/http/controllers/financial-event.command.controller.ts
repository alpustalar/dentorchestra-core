import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { AuthGuard, CapabilityGuard } from '@modules/identity/auth/auth/guards';
import { GetContext, HasCapability, IGetContext } from '@common/decorators';
import { TSCommandBus } from '@common/cqrs/type-safe-command-bus';
import { RecordSupplierPaymentCommand } from '@modules/finance/accounting/financial-events/application/commands/record-supplier-payment/record-supplier-payment.command';
import {
  PostUnpostedFinancialEventsDto,
  RecordSupplierPaymentDto,
} from '@shared/modules/financial-event/dto/commands';
import { PostUnpostedFinancialEventsCommand } from '@modules/finance/accounting/posting/application/commands/post-unposted-financial-events/post-unposted-financial-events.command';
import { CAPABILITIES } from '@src/infrastructure/persistence/prisma/data/modules';

const { FINANCIALEVENT } = CAPABILITIES;
@UseGuards(AuthGuard, CapabilityGuard)
@Controller('financial-events')
export class FinancialEventCommandController {
  constructor(private readonly commandBus: TSCommandBus) {}

  /** Satıcıya ödeme kaydeder — 320'deki cari borcu kapatır. */
  @HasCapability(FINANCIALEVENT.create)
  @Post('supplier-payments')
  recordSupplierPayment(
    @Body() dto: RecordSupplierPaymentDto,
    @GetContext() ctx: IGetContext
  ) {
    return this.commandBus.execute(
      new RecordSupplierPaymentCommand({ data: dto, ctx })
    );
  }

  /**
   * Fişlenmemiş ekonomik olayları yeniden fişler (backfill). Posting hatası
   * dinleyicide yutulduğu ve otomatik yeniden deneme olmadığı için düzeltme yolu
   * budur: CRITICAL uyarı geldiğinde ya da dönem kapanışı "fişlenmemiş olay var"
   * diye reddettiğinde çağrılır.
   */
  @HasCapability(FINANCIALEVENT.update)
  @Post('post-unposted')
  postUnposted(
    @Body() dto: PostUnpostedFinancialEventsDto,
    @GetContext() ctx: IGetContext
  ) {
    return this.commandBus.execute(
      new PostUnpostedFinancialEventsCommand({
        clinicId: dto.clinicId,
        from: dto.from,
        to: dto.to,
        ctx,
      })
    );
  }
}
