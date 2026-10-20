import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuthGuard, CapabilityGuard } from '@modules/identity/auth/auth/guards';
import { GetContext, HasCapability, IGetContext } from '@common/decorators';
import { PaginationDto } from '@shared';
import { TSQueryBus } from '@common/cqrs/type-safe-query-bus';
import { GetPurchaseInvoicesQuery } from '@modules/finance/purchase-invoice/application/queries/get-purchase-invoices/get-purchase-invoices.query';
import { Serialize } from '@common/decorators/serialize.decorator';
import { PurchaseInvoiceResponseDto } from '@modules/finance/purchase-invoice/presentation/http/dto/purchase-invoice-response.dto';
import type { PurchaseInvoice } from '@shared';
import { CAPABILITIES } from '@src/infrastructure/persistence/prisma/data/modules';

const { PURCHASEINVOICE } = CAPABILITIES;
@UseGuards(AuthGuard, CapabilityGuard)
@HasCapability(PURCHASEINVOICE.read)
@Controller()
export class PurchaseInvoiceQueryController {
  constructor(private readonly queryBus: TSQueryBus) {}
  @Get()
  @Serialize<PurchaseInvoice, PurchaseInvoiceResponseDto>(
    PurchaseInvoiceResponseDto,
    { isArray: true }
  )
  list(@Query() pagination: PaginationDto, @GetContext() ctx: IGetContext) {
    return this.queryBus.execute(new GetPurchaseInvoicesQuery(pagination, ctx));
  }
}
