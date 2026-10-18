import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard, CapabilityGuard } from '@modules/identity/auth/auth/guards';
import { GetContext, HasCapability, IGetContext } from '@common/decorators';
import { TSQueryBus } from '@common/cqrs/type-safe-query-bus';
import { PaginationDto } from '@shared';
import { GetPurchaseOrdersFilterDto } from '@shared/modules/purchasing/dto/queries';
import { GetPurchaseOrdersQuery } from '@modules/supply/purchasing/application/queries/get-purchase-orders/get-purchase-orders.query';
import { GetPurchaseOrderByIdQuery } from '@modules/supply/purchasing/application/queries/get-purchase-order-by-id/get-purchase-order-by-id.query';
import { GetPurchaseOrderMatchSummaryQuery } from '@modules/supply/purchasing/application/queries/get-purchase-order-match-summary/get-purchase-order-match-summary.query';
import { GetGoodsReceivedNotInvoicedQuery } from '@modules/supply/purchasing/application/queries/get-goods-received-not-invoiced/get-goods-received-not-invoiced.query';
import { Serialize } from '@common/decorators/serialize.decorator';
import { PurchaseOrderResponseDto } from '@modules/supply/purchasing/presentation/http/dto/purchasing-response.dto';
import type { PurchaseOrderWithItems } from '@modules/supply/purchasing/domain/contracts';
import { CAPABILITIES } from '@src/infrastructure/persistence/prisma/data/modules';

const { PURCHASEORDER, FINANCE } = CAPABILITIES;
@UseGuards(AuthGuard, CapabilityGuard)
@HasCapability(PURCHASEORDER.read)
@Controller('orders')
export class PurchaseOrderQueryController {
  constructor(private readonly queryBus: TSQueryBus) {}
  @Get()
  @Serialize<PurchaseOrderWithItems, PurchaseOrderResponseDto>(
    PurchaseOrderResponseDto
  )
  list(
    @Query() dto: GetPurchaseOrdersFilterDto,
    @Query() pagination: PaginationDto,
    @GetContext() ctx: IGetContext
  ) {
    return this.queryBus.execute(
      new GetPurchaseOrdersQuery({ filter: dto, pagination, ctx })
    );
  }
  /** Sipariş / teslim / fatura üçlü karşılaştırması (3-way match özeti). */
  @Get(':orderId/match-summary')
  matchSummary(
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @GetContext() ctx: IGetContext
  ) {
    return this.queryBus.execute(
      new GetPurchaseOrderMatchSummaryQuery(orderId, ctx)
    );
  }

  /**
   * Mal kabul ↔ fatura mutabakatı: faturası gelmemiş mal (ay sonu tahakkuk adayı)
   * ve malı gelmemiş fatura (avans) para birimi başına **netleştirilmeden**.
   *
   * Sabit segment `:orderId`'den ÖNCE tanımlı olmak zorunda — Nest rotaları
   * tanım sırasına göre eşleştirir, sonra tanımlansaydı `:orderId` bu yolu yutar
   * ve `ParseUUIDPipe` 400 verirdi.
   *
   * Yetki sınıf seviyesini **ezer** (`getAllAndOverride`): rapor tedarikçi başına
   * tutar ve tahakkuk adayı üretiyor → `purchaseorder:read` değil `finance:read`.
   */
  @HasCapability(FINANCE.read)
  @Get('goods-received-not-invoiced')
  goodsReceivedNotInvoiced(
    @Query('clinicId', ParseUUIDPipe) clinicId: string,
    @GetContext() ctx: IGetContext
  ) {
    return this.queryBus.execute(
      new GetGoodsReceivedNotInvoicedQuery(clinicId, ctx)
    );
  }

  @Get(':orderId')
  @Serialize<PurchaseOrderWithItems, PurchaseOrderResponseDto>(
    PurchaseOrderResponseDto
  )
  getById(
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @GetContext() ctx: IGetContext
  ) {
    return this.queryBus.execute(new GetPurchaseOrderByIdQuery(orderId, ctx));
  }
}
