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
import { GetWorkOrdersFilterDto } from '@shared/modules/work-order/dto/queries';
import { GetWorkOrdersQuery } from '@modules/supply/work-order/application/queries/get-work-orders/get-work-orders.query';
import { GetWorkOrderByIdQuery } from '@modules/supply/work-order/application/queries/get-work-order-by-id/get-work-order-by-id.query';
import { GetWorkOrderSummaryQuery } from '@modules/supply/work-order/application/queries/get-work-order-summary/get-work-order-summary.query';
import { Serialize } from '@common/decorators/serialize.decorator';
import {
  ExternalWorkOrderResponseDto,
  WorkOrderSummaryResponseDto,
} from '@modules/supply/work-order/presentation/http/dto/work-order-response.dto';
import type {
  ExternalWorkOrderWithItems,
  WorkOrderSummary,
} from '@modules/supply/work-order/domain/contracts';
import { CAPABILITIES } from '@shared/datasets';

const { EXTERNALWORKORDER } = CAPABILITIES;
@UseGuards(AuthGuard, CapabilityGuard)
@HasCapability(EXTERNALWORKORDER.read)
@Controller('orders')
export class WorkOrderQueryController {
  constructor(private readonly queryBus: TSQueryBus) {}

  @Get()
  @Serialize<ExternalWorkOrderWithItems, ExternalWorkOrderResponseDto>(
    ExternalWorkOrderResponseDto,
    { isArray: true }
  )
  list(
    @Query() dto: GetWorkOrdersFilterDto,
    @Query() pagination: PaginationDto,
    @GetContext() ctx: IGetContext
  ) {
    return this.queryBus.execute(
      new GetWorkOrdersQuery({ filter: dto, pagination, ctx })
    );
  }

  @Get('summary')
  @Serialize<WorkOrderSummary, WorkOrderSummaryResponseDto>(
    WorkOrderSummaryResponseDto
  )
  summary(@GetContext() ctx: IGetContext) {
    return this.queryBus.execute(new GetWorkOrderSummaryQuery(ctx));
  }

  @Get(':id')
  @Serialize<ExternalWorkOrderWithItems, ExternalWorkOrderResponseDto>(
    ExternalWorkOrderResponseDto
  )
  detail(
    @Param('id', ParseUUIDPipe) workOrderId: string,
    @GetContext() ctx: IGetContext
  ) {
    return this.queryBus.execute(new GetWorkOrderByIdQuery(workOrderId, ctx));
  }
}
