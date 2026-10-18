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
import { Serialize } from '@common/decorators/serialize.decorator';
import { PaginationDto, StockMovement } from '@shared';
import {
  StockLevelResponseDto,
  StockMovementResponseDto,
} from '@modules/supply/inventory/presentation/http/dto';
import { StockLevel } from '@modules/supply/inventory/domain/contracts';
import { GetStockMovementsDto } from '@shared/modules/inventory/dto/queries';
import { TSQueryBus } from '@common/cqrs/type-safe-query-bus';
import { GetProductStockQuery } from '@modules/supply/inventory/application/queries/get-product-stock/get-product-stock.query';
import { GetLowStockAlertsQuery } from '@modules/supply/inventory/application/queries/get-low-stock-alerts/get-low-stock-alerts.query';
import { GetStockMovementsQuery } from '@modules/supply/inventory/application/queries/get-stock-movements/get-stock-movements.query';
import { GetInventoryValuationQuery } from '@modules/supply/inventory/application/queries/get-inventory-valuation/get-inventory-valuation.query';
import { GetInventoryLedgerReconciliationQuery } from '@modules/supply/inventory/application/queries/get-inventory-ledger-reconciliation/get-inventory-ledger-reconciliation.query';
import { GetBatchQuantityDriftQuery } from '@modules/supply/inventory/application/queries/get-batch-quantity-drift/get-batch-quantity-drift.query';
import { CAPABILITIES } from '@src/infrastructure/persistence/prisma/data/modules';

/**
 * Stok operasyonları klinik bağlamında yürür (clinic = source-of-truth):
 * mal kabul, sayım düzeltme, tüketim ve stok/hareket sorguları.
 */

const { STOCKMOVEMENT, FINANCE } = CAPABILITIES;

@UseGuards(AuthGuard, CapabilityGuard)
@Controller('clinics/:clinicId/stock')
export class StockQueryController {
  constructor(private readonly queryBus: TSQueryBus) {}

  @HasCapability(STOCKMOVEMENT.read)
  @Get()
  @Serialize<StockLevel, StockLevelResponseDto>(StockLevelResponseDto)
  productStock(
    @Param('clinicId') clinicId: string,
    @GetContext() ctx: IGetContext
  ) {
    return this.queryBus.execute(new GetProductStockQuery(clinicId, ctx));
  }

  @HasCapability(STOCKMOVEMENT.read)
  @Get('low-alerts')
  @Serialize<StockLevel, StockLevelResponseDto>(StockLevelResponseDto)
  lowStockAlerts(
    @Param('clinicId') clinicId: string,
    @GetContext() ctx: IGetContext
  ) {
    return this.queryBus.execute(new GetLowStockAlertsQuery(clinicId, ctx));
  }

  @HasCapability(STOCKMOVEMENT.read)
  @Get('movements')
  @Serialize<StockMovement, StockMovementResponseDto>(StockMovementResponseDto)
  movements(
    @Param('clinicId') clinicId: string,
    @Query() dto: GetStockMovementsDto,
    @Query() pagination: PaginationDto,
    @GetContext() ctx: IGetContext
  ) {
    return this.queryBus.execute(
      new GetStockMovementsQuery({ clinicId, data: dto, pagination, ctx })
    );
  }

  /**
   * Envanter değerlemesi — eldeki stoğun parti bazlı fiili maliyeti.
   * Tutar taşıdığı için **finans** yetkisi ister: miktarı görmek (depo) ile
   * değeri görmek (muhasebe) aynı şey değildir.
   */
  @HasCapability(FINANCE.read)
  @Get('valuation')
  valuation(
    @Param('clinicId', ParseUUIDPipe) clinicId: string,
    @GetContext() ctx: IGetContext
  ) {
    return this.queryBus.execute(new GetInventoryValuationQuery(clinicId, ctx));
  }

  /** Envanter ↔ defter (150) mutabakatı — farkı gösterir, düzeltme yapmaz. */
  @HasCapability(FINANCE.read)
  @Get('ledger-reconciliation')
  ledgerReconciliation(
    @Param('clinicId', ParseUUIDPipe) clinicId: string,
    @GetContext() ctx: IGetContext
  ) {
    return this.queryBus.execute(
      new GetInventoryLedgerReconciliationQuery(clinicId, ctx)
    );
  }

  /**
   * Parti miktarı ↔ hareket toplamı sapma raporu. Değerlemenin **tabanını**
   * denetler: `product_batches.quantity` türetilmiş bir alandır ve kayarsa
   * 150 mutabakatı farkı "sebebi bilinmeyen" olarak gösterir. Sapmayı gösterir,
   * onarmaz.
   */
  @HasCapability(FINANCE.read)
  @Get('batch-drift')
  batchQuantityDrift(
    @Param('clinicId', ParseUUIDPipe) clinicId: string,
    @GetContext() ctx: IGetContext
  ) {
    return this.queryBus.execute(new GetBatchQuantityDriftQuery(clinicId, ctx));
  }
}
